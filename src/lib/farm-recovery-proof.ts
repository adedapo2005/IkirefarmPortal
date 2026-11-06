import { FARM_OPERATION_DEFINITIONS, type FarmOperationData } from "./farm-operational-core.ts";
import type { ResourceRecord } from "./resource-workflow.ts";
import type { RecoverableFarmAction } from "./farm-write-receipt.ts";

export type RecoveryProof =
  | { state: "unconfirmed"; operationId: string }
  | { state: "cancelled"; operationId: string }
  | { state: "committed"; operationId: string; action: RecoverableFarmAction; record: ResourceRecord<FarmOperationData> };

/** Receipt read validation, distinct from matching a just-submitted form.
 * After reload only the opaque operation ID remains. The authorized server
 * proves its original committed snapshot; no draft values are reconstructed. */
export function validateRecoveryProof(
  value: unknown, operationId: string, kind: "breed" | "house", actor: string, company: string, site: string,
): RecoveryProof | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Partial<RecoveryProof>;
  if (body.operationId !== operationId) return null;
  if (body.state === "unconfirmed" || body.state === "cancelled") return {state:body.state,operationId};
  if (body.state !== "committed") return null;
  const {record,action} = body;
  if (!record || !action || !["create","update","activate","deactivate","maintenance"].includes(action) ||
      !record.id || typeof record.id !== "string" || record.resourceType !== kind ||
      !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      record.subject?.companyKey !== company || record.subject.locationKey !== site ||
      record.subject.resourceType !== kind || record.subject.resourceId !== record.id ||
      record.data?.kind !== kind || FARM_OPERATION_DEFINITIONS[kind].validate(record.data).length) return null;
  if (!(kind === "breed" ? ["active","inactive"] : ["active","inactive","maintenance"]).includes(record.state)) return null;
  if (action === "create" && (record.revision !== 1 || record.createdBy !== actor ||
      record.state !== (kind === "breed" ? "active" : "inactive"))) return null;
  if (action !== "create" && record.revision < 2) return null;
  if (action === "activate" && record.state !== "active" ||
      action === "deactivate" && record.state !== "inactive" ||
      action === "maintenance" && (kind !== "house" || record.state !== "maintenance")) return null;
  return {state:"committed",operationId,action,record};
}
