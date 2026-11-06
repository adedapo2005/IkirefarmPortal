import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";
import { JOURNAL_POSTING_ENABLED, JOURNAL_RECORD_TYPE } from "./finance-balanced-journal.ts";

export type JournalReadiness = Readonly<{
  state: "posting-disabled";
  source: "authenticated-finance-journal-records";
  journalRecordCount: number;
  statusCounts: Readonly<{ draft: number; submitted: number; posted: number }>;
  postingAvailable: false;
  legacyIndividualEntriesCertified: false;
  balancesCertified: false;
  reason: string;
}>;

export async function getFinanceJournalReadiness(
  db: D1Database,
  principal: AuthenticatedPrincipal,
): Promise<JournalReadiness> {
  if (JOURNAL_POSTING_ENABLED !== false) throw new Error("FINANCE_JOURNAL_UNEXPECTED_POSTING_ENABLEMENT");
  const scope = principal.organizationScope;
  if (!scope?.companyKey || !scope.locationKey) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["scope-missing"]);
  }
  const subject = {
    resourceType: JOURNAL_RECORD_TYPE,
    companyKey: scope.companyKey,
    locationKey: scope.locationKey,
    departmentKey: scope.departmentKey,
  };
  const decision = authorize(principal, {
    channel: "api", action: "view", permission: "finance.view", subject,
  });
  if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);

  // Only an explicit effective finance.view grant may select aggregation scope.
  // Owner identity never upgrades a department grant to company/site-wide.
  // Preserve separately composed active-role scope alternatives; authorize()
  // above already enforces active-role deny-wins and company/site authority.
  const configuredScopes = principal.permissionScopeSets?.["finance.view"];
  const effectiveScopes = configuredScopes?.length
    ? configuredScopes : [principal.permissionScopes["finance.view"]];
  const allowedScope = effectiveScopes.includes("all")
    ? "all" : effectiveScopes.includes("department") ? "department" : null;
  if (!allowedScope || (allowedScope === "department" &&
      (typeof scope.departmentKey !== "string" || !scope.departmentKey.trim()))) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["journal-aggregation-not-authorized"]);
  }
  const restrictedDepartment = allowedScope === "department";
  const sql = "SELECT state, COUNT(*) AS count FROM resource_records "
    + "WHERE resource_type = ? AND deleted_at IS NULL "
    + "AND json_extract(subject_json, '$.companyKey') = ? "
    + "AND json_extract(subject_json, '$.locationKey') = ? "
    + (restrictedDepartment ? "AND json_extract(subject_json, '$.departmentKey') = ? " : "")
    + "GROUP BY state";
  const parameters = restrictedDepartment
    ? [JOURNAL_RECORD_TYPE,scope.companyKey,scope.locationKey,scope.departmentKey]
    : [JOURNAL_RECORD_TYPE,scope.companyKey,scope.locationKey];
  const result = await db.prepare(sql).bind(...parameters).all<{state: string;count: number}>();
  const counts = { draft: 0, submitted: 0, posted: 0 };
  for (const item of result.results || []) {
    if (!Object.hasOwn(counts,item.state) || !Number.isSafeInteger(item.count) || item.count < 0) {
      throw new Error("FINANCE_JOURNAL_READINESS_UNVERIFIED_RECORDS");
    }
    counts[item.state as keyof typeof counts] = item.count;
  }
  const journalRecordCount = counts.draft + counts.submitted + counts.posted;
  if (!Number.isSafeInteger(journalRecordCount)) throw new Error("FINANCE_JOURNAL_COUNT_OUT_OF_RANGE");
  return Object.freeze({
    state: "posting-disabled",
    source: "authenticated-finance-journal-records",
    journalRecordCount,
    statusCounts: Object.freeze(counts),
    postingAvailable: false,
    legacyIndividualEntriesCertified: false,
    balancesCertified: false,
    reason: "Balanced journal writes are not enabled until atomic posting, account catalogue, reversal and independent approval controls pass their release gates.",
  });
}
