import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";

type SupplierRow = {
  id: string; resource_type: string; state: string; revision: number;
  subject_json: string; data_json: string; updated_at: string | null;
};
export type SupplierWorkspaceRecord = {
  id: string; code: string; name: string; status: "active" | "inactive";
  contactEmail: string | null; evidenceCount: number;
  revision: number; updatedAt: string | null;
};
const LIMIT = 10000;
const PAGE_SIZE = 200;
const BROWSE_PAGE_SIZE = 40;
const clean = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim()) && value.length <= 320;

/**
 * Supplier sourcing overview: real company/site-scoped D1 records, never the
 * supplier design fixture. Scan in bounded D1 batches, then apply the same
 * per-record permission/scope policy as the canonical procurement API.
 */
export async function getSupplierWorkspace(
  db: D1Database, principal: AuthenticatedPrincipal, page=0, query="",
) {
  const org=principal.organizationScope;
  const owner=principal.isOwner && principal.accessState === "owner";
  if (!org?.companyKey || !org?.locationKey || !principal.farmAuthorized ||
      principal.restriction !== "none" ||
      (!owner && (!principal.permissions.includes("procurement.view") || !principal.permissionScopes["procurement.view"]))) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  if (!Number.isSafeInteger(page) || page < 0 || page > Math.ceil(LIMIT/BROWSE_PAGE_SIZE)) {
    throw new ResourceWorkflowError("VALIDATION_FAILED", ["supplier list page is invalid"]);
  }
  const needle=query.trim().toLocaleLowerCase().slice(0,80);
  const sql="SELECT id, resource_type, state, revision, subject_json, data_json, updated_at " +
    "FROM resource_records WHERE resource_type = 'supplier' AND deleted_at IS NULL " +
    "AND json_extract(subject_json, '$.companyKey') = ? " +
    "AND json_extract(subject_json, '$.locationKey') = ? " +
    "ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?";

  const all: SupplierWorkspaceRecord[]=[];
  for (let offset=0; ; offset+=PAGE_SIZE) {
    const result=await db.prepare(sql)
      .bind(org.companyKey,org.locationKey,PAGE_SIZE,offset)
      .all<SupplierRow>();
    const rows=result.results??[];
    if (offset + rows.length > LIMIT) throw new Error("SUPPLIER_WORKSPACE_RECORD_LIMIT");
    for (const row of rows) {
      let subject: unknown, data: unknown;
      try { subject=JSON.parse(row.subject_json); data=JSON.parse(row.data_json); }
      catch { throw new Error("SUPPLIER_WORKSPACE_INVALID_DATA"); }
      if (!clean(subject) || !clean(data)) throw new Error("SUPPLIER_WORKSPACE_INVALID_DATA");
      if (subject.companyKey !== org.companyKey || subject.locationKey !== org.locationKey) continue;
      if (!authorize(principal, {
        channel:"api", action:"view", permission:"procurement.view",
        subject:subject as AuthorizationSubject,
      }).allowed) continue;
      if (row.resource_type !== "supplier" || data.kind !== "supplier" ||
          typeof row.id !== "string" || !nonempty(data.supplierCode) || !nonempty(data.name) ||
          !Number.isSafeInteger(row.revision) || row.revision < 1 ||
          !["active","inactive"].includes(String(data.status))) {
        throw new Error("SUPPLIER_WORKSPACE_INVALID_RECORD");
      }
      const status: SupplierWorkspaceRecord["status"] =
        row.state==="active" && data.status==="active" ? "active" : "inactive";
      if (data.contactEmail!==undefined && data.contactEmail!==null && typeof data.contactEmail!=="string") {
        throw new Error("SUPPLIER_WORKSPACE_INVALID_CONTACT");
      }
      const ids=data.evidenceIds;
      if (ids!==undefined && (!Array.isArray(ids) || ids.some(id=>typeof id!=="string"))) {
        throw new Error("SUPPLIER_WORKSPACE_INVALID_EVIDENCE");
      }
      all.push({
        id:row.id,code:data.supplierCode,name:data.name,status,
        contactEmail:typeof data.contactEmail==="string" && data.contactEmail.trim() ? data.contactEmail.trim() : null,
        evidenceCount:Array.isArray(ids)?ids.length:0,
        revision:row.revision,
        updatedAt:typeof row.updated_at==="string" && Number.isFinite(Date.parse(row.updated_at)) ? row.updated_at : null,
      });
    }
    if (rows.length<PAGE_SIZE) break;
  }
  const matching=needle
    ? all.filter(record=>record.code.toLocaleLowerCase().includes(needle) || record.name.toLocaleLowerCase().includes(needle))
    : all;
  const start=page*BROWSE_PAGE_SIZE;
  const items=matching.slice(start,start+BROWSE_PAGE_SIZE);
  const metrics={
    registered:all.length,
    active:all.filter(record=>record.status==="active").length,
    inactive:all.filter(record=>record.status==="inactive").length,
    missingContact:all.filter(record=>!record.contactEmail).length,
    missingEvidenceIds:all.filter(record=>record.evidenceCount===0).length,
  };
  return {
    state:all.length?"available" as const:"no-data" as const,
    source:"Authenticated Cloudflare D1 supplier records",
    asOf:new Date().toISOString(),
    metrics, items, matchedCount:matching.length,
    page, pageSize:BROWSE_PAGE_SIZE,
    nextPage:start+BROWSE_PAGE_SIZE<matching.length ? page+1 : null,
    previousPage:page>0 ? page-1 : null,
    evidenceNote:"Evidence IDs are references only; they do not establish that documents were uploaded or approved.",
  };
}


/**
 * Flock placement may select a supplier only if that operator can view the
 * actual procurement register. Restricted identities never receive options.
 * Reuse the supplier directory's exact per-record authorization policy.
 */
export async function getFlockSourceSuppliers(db: D1Database, principal: AuthenticatedPrincipal) {
  const options: { id: string; code: string; name: string }[] = [];
  try {
    let page = 0;
    for (;;) {
      const roster = await getSupplierWorkspace(db, principal, page);
      // Do not silently truncate a select list and imply full coverage.
      if (roster.metrics.registered > 400) throw new Error("FLOCK_SOURCE_SUPPLIER_LIMIT");
      for (const supplier of roster.items) {
        if (supplier.status === "active") {
          options.push({ id: supplier.id, code: supplier.code, name: supplier.name });
        }
      }
      if (roster.nextPage === null) break;
      page = roster.nextPage;
    }
  } catch (error) {
    if (error instanceof ResourceWorkflowError && error.code === "AUTHORIZATION_DENIED") {
      return { state: "restricted" as const, options: [] };
    }
    throw error;
  }
  options.sort((a,b) => a.name.localeCompare(b.name, "en-NG"));
  return {
    state: options.length ? "available" as const : "no-data" as const,
    options,
  };
}
