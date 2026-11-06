import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import type { DailyReportAuthority } from "./stage24-daily-report-d1-guard.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";
import { executeDailyFlockWrite, recoverDailyFlockWrite, cancelDailyFlockWrite, type DailyFlockWriteRequest } from "./daily-flock-recovery.ts";

const json = (value: unknown, status = 200, operationId?: string) => Response.json(value, {
  status, headers: { "cache-control": "no-store", ...(operationId ? {
    "x-daily-flock-operation-id": operationId, "x-daily-flock-receipt-state": "committed",
  } : {}) },
});

async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  const invalid = () => new ResourceWorkflowError("VALIDATION_FAILED", ["Invalid Request Body"]);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json") ||
      Number(request.headers.get("content-length") || 0) > 20_000) throw invalid();
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 20_000) throw invalid();
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw invalid(); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid();
  return body as Record<string, unknown>;
}

/** The portal authenticates and enforces same-origin before this handler.
 * Each database operation independently rechecks live authority. */
export async function dailyFlockRecoveryHttp(
  db: D1Database, request: Request, parts: string[], principal: AuthenticatedPrincipal,
  authority: DailyReportAuthority,
): Promise<Response> {
  const invalid = () => new ResourceWorkflowError("VALIDATION_FAILED", ["Invalid Recovery Request"]);
  if (parts[3] === "write-recovery") {
    if (parts.length !== 5) throw invalid();
    if (request.method === "GET") return json(await recoverDailyFlockWrite(db,principal,authority,parts[4]));
    if (request.method === "POST") {
      const body = await bodyObject(request);
      if (body.action !== "cancel" || Object.keys(body).length !== 1) throw invalid();
      return json(await cancelDailyFlockWrite(db,principal,authority,parts[4]));
    }
    throw invalid();
  }
  const operationId = request.headers.get("x-daily-flock-operation-id");
  if (!operationId) throw invalid();
  const body = await bodyObject(request);
  let input: DailyFlockWriteRequest;
  if (request.method === "POST" && parts.length === 3) {
    if (Object.keys(body).some(key => key !== "data")) throw invalid();
    input = {action:"create",data:body.data};
  } else if (request.method === "PATCH" && parts.length === 4 && parts[3]) {
    if (Object.keys(body).some(key => !["data","expectedRevision"].includes(key))) throw invalid();
    input = {action:"update",recordId:parts[3],expectedRevision:body.expectedRevision as number,data:body.data};
  } else if (request.method === "POST" && parts.length === 5 && parts[3] && parts[4] === "transition") {
    if (body.to !== "submitted" || Object.keys(body).some(key => !["to","expectedRevision"].includes(key))) throw invalid();
    input = {action:"submit",recordId:parts[3],expectedRevision:body.expectedRevision as number};
  } else throw invalid();
  const record = await executeDailyFlockWrite(db,principal,authority,operationId,input);
  return json(record,input.action === "create" ? 201 : 200,operationId);
}
