import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import type { DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";
import type { RecoverableFarmKind } from "./farm-write-receipt.ts";
import type { FarmOperationData } from "./farm-operational-core.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";
import { executeRecoverableFarmWrite, recoverFarmWrite, cancelFarmWrite, type FarmWriteRequest } from "./farm-operation-recovery.ts";

const json = (value: unknown, status = 200, operationId?: string) => Response.json(value, {
  status, headers: { "cache-control": "no-store", ...(operationId ? {
    "x-farm-operation-id": operationId, "x-farm-receipt-state": "committed",
  } : {}) },
});

async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json") ||
      Number(request.headers.get("content-length") || 0) > 20_000)
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["Invalid Request Body"]);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 20_000)
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["Request Too Large"]);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new ResourceWorkflowError("VALIDATION_FAILED"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ResourceWorkflowError("VALIDATION_FAILED");
  return body as Record<string, unknown>;
}

/** Called only after the portal's existing session resolver and same-origin
 * mutation gate. Live authority is checked again inside every DB operation. */
export async function farmRecoveryHttp(
  db: D1Database, request: Request, parts: string[], principal: AuthenticatedPrincipal,
  authority: DailyReportAuthority, kind: RecoverableFarmKind,
): Promise<Response> {
  const invalid = () => new ResourceWorkflowError("VALIDATION_FAILED", ["Invalid Recovery Request"]);
  if (parts[3] === "write-recovery") {
    if (parts.length !== 5) throw invalid();
    if (request.method === "GET") return json(await recoverFarmWrite(db,principal,authority,kind,parts[4]));
    if (request.method === "POST") {
      const body = await bodyObject(request);
      if (body?.action !== "cancel" || Object.keys(body).length !== 1) throw invalid();
      return json(await cancelFarmWrite(db,principal,authority,kind,parts[4]));
    }
    throw invalid();
  }
  const operationId = request.headers.get("x-farm-operation-id");
  if (!operationId || !["POST","PATCH"].includes(request.method) || ![3,4].includes(parts.length)) throw invalid();
  const body = await bodyObject(request);
  const expectedRevision = body.expectedRevision;
  if (parts[3] && (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) throw invalid();
  let input: FarmWriteRequest;
  if (request.method === "PATCH") {
    if (!parts[3] || Object.keys(body).some(key => !["data","expectedRevision"].includes(key))) throw invalid();
    input = {action:"update",recordId:parts[3],expectedRevision:expectedRevision as number,data:body.data as FarmOperationData};
  } else if (parts[3]) {
    if (typeof body.to !== "string" || !["active","inactive","maintenance"].includes(body.to) ||
        Object.keys(body).some(key => !["to","expectedRevision"].includes(key))) throw invalid();
    input = {action:body.to === "active" ? "activate" : body.to === "inactive" ? "deactivate" : "maintenance",
      recordId:parts[3],expectedRevision:expectedRevision as number};
  } else {
    if (Object.keys(body).some(key => key !== "data")) throw invalid();
    input = {action:"create",data:body.data as FarmOperationData};
  }
  const record = await executeRecoverableFarmWrite(db,principal,authority,kind,operationId,input);
  return json(record,input.action === "create" ? 201 : 200,operationId);
}
