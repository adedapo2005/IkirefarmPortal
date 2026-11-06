/**
 * Stage 21D pre-integration contract boundary.
 * Describes expected server-verified fields; DOES NOT grant mutation rights,
 * provide trusted records, or authorize submission from the review fixture.
 */
export type FormFieldKind = "reference" | "entity" | "date" | "number" | "text" | "email" | "select";
export type FormAuthority = "fixture" | "server-verified";
export type FarmFormField = {
  key: string;
  label: string;
  kind: FormFieldKind;
  required: boolean;
  unit?: string;
  entityType?: string;
  suggestionSource?: string;
  min?: number;
  max?: number;
  options?: readonly string[];
};
export type FarmFormContract = {
  id: string;
  title: string;
  route: string;
  requiredPermission: string;
  authority: FormAuthority;
  fields: readonly FarmFormField[];
  requiresServerValidation: true;
  requiresAuditTrail: true;
  requiresDuplicateCheck: true;
};
type ManifestInput = {
  id: string;
  title: string;
  route: string;
  permission: string;
  entity: string;
  columns: readonly string[];
  unit: string;
};

function normalizeKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function createFixtureContract(input: ManifestInput): FarmFormContract {
  const fields: FarmFormField[] = [
    { key: "reference", label: "Record reference", kind: "reference", required: true },
    { key: "context", label: input.entity, kind: "entity", required: true, entityType: normalizeKey(input.entity) },
    { key: "date", label: "Record date", kind: "date", required: true },
    ...input.columns.map((label) => ({ key: normalizeKey(label), label, kind: "text" as const, required: true })),
    ...(input.unit ? [{ key: "quantity", label: "Quantity", kind: "number" as const, required: true, min: 0, unit: input.unit }] : []),
  ];
  return {
    id: input.id,
    title: input.title,
    route: input.route,
    requiredPermission: input.permission,
    authority: "fixture",
    fields,
    requiresServerValidation: true,
    requiresAuditTrail: true,
    requiresDuplicateCheck: true,
  };
}
export type FormRecordDraft = Record<string, string>;
export type FormReviewResult = {
  valid: boolean;
  errors: Readonly<Record<string, string>>;
  needsServerVerification: boolean;
};
/** Client-side preparation only. A valid local draft is NOT ready for a business write. */
export function reviewFixtureDraft(contract: FarmFormContract, draft: FormRecordDraft): FormReviewResult {
  const errors: Record<string, string> = {};
  for (const field of contract.fields) {
    const value = String(draft[field.key] ?? "").trim();
    if (field.required && !value) { errors[field.key] = `Enter ${field.label.toLowerCase()}.`; continue; }
    if (!value) continue;
    if (field.kind === "number") {
      const amount = Number(value);
      if (!Number.isFinite(amount) || (field.min !== undefined && amount < field.min) || (field.max !== undefined && amount > field.max)) {
        errors[field.key] = `Enter a valid ${field.unit || "number"} amount.`;
      }
    }
    if (field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key] = "Enter a valid email address.";
    if (field.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors[field.key] = "Enter a valid date.";
  }
  return { valid: Object.keys(errors).length === 0, errors, needsServerVerification: true };
}
/** Reject client-originated suggestions as an authority source. */
export function maySubmitAuthoritatively(contract: FarmFormContract, verifiedByServer: boolean, hasAuditSink: boolean): boolean {
  return contract.authority === "server-verified" && verifiedByServer && hasAuditSink;
}
