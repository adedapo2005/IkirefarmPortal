import { ResourceWorkflowError } from "./resource-workflow.ts";
import { PORTAL_AUTHORITY_FINGERPRINT_SQL } from "./portal-authority-fingerprint.ts";

/** Checks the real registered Flock during an atomic D1 Daily Report mutation. */
export const DAILY_REPORT_FLOCK_ATWRITE_SQL =
 "EXISTS (SELECT 1 FROM resource_records AS parent "+
 "WHERE parent.id = ? AND parent.resource_type = 'flock' "+
 "AND parent.state = 'active' AND parent.deleted_at IS NULL "+
 "AND json_valid(parent.subject_json) = 1 AND json_valid(parent.data_json) = 1 "+
 "AND json_extract(parent.subject_json, '$.resourceType') = 'flock' "+
 "AND (json_type(parent.subject_json,'$.resourceId') IS NULL OR json_extract(parent.subject_json,'$.resourceId') = parent.id) "+
 "AND json_extract(parent.subject_json, '$.companyKey') = ? "+
 "AND json_extract(parent.subject_json, '$.locationKey') = ? "+
 "AND json_extract(parent.data_json, '$.kind') = 'flock' "+
 "AND LOWER(TRIM(json_extract(parent.data_json, '$.flockCode'))) = LOWER(TRIM(?)) "+
 "AND julianday(? || 'T00:00:00+01:00') >= julianday(json_extract(parent.data_json, '$.placementDate') || 'T00:00:00+01:00') "+
 "AND NOT EXISTS (SELECT 1 FROM json_tree(parent.subject_json) AS entry "+
 "WHERE entry.key IS NOT NULL GROUP BY entry.parent, entry.key HAVING COUNT(*) > 1) "+
 "AND NOT EXISTS (SELECT 1 FROM json_tree(parent.data_json) AS entry "+
 "WHERE entry.key IS NOT NULL GROUP BY entry.parent, entry.key HAVING COUNT(*) > 1))";

export function dailyReportFlockWriteParams(record: Readonly<{
  subject: Readonly<{ companyKey?: string; locationKey?: string }>;
  data: unknown;
}>): readonly string[] {
 const data = record.data && typeof record.data === "object" && !Array.isArray(record.data)
   ? record.data as Record<string, unknown> : null;
 const company = record.subject.companyKey;
 const site = record.subject.locationKey;
 if(data?.kind !== "daily-flock-report" ||
    typeof data.flockId !== "string" || !data.flockId.trim() ||
    typeof data.flockCode !== "string" || !data.flockCode.trim() ||
    typeof data.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.localDate) ||
    !company?.trim() || !site?.trim()) {
   throw new ResourceWorkflowError("VALIDATION_FAILED", ["daily report Flock identity is missing"]);
 }
 return [data.flockId, company, site, data.flockCode, data.localDate];
}


/** Verify that explicitly claimed "None Today" does not contradict canonical
 * completed operations for the same Flock, site and Lagos local day.
 * Feed DRAFT and Vaccination PLANNED are not completed activity; a POSTED
 * stock issue/receipt is not Flock feed INTAKE without a CONSUMED movement.
 * Recorded Mortality/Medication and ADMINISTERED Vaccination are real events.
 * This check executes INSIDE the D1 mutation, not at UI form validation. */
const NONE_TODAY_ONLY_SQL =
 "NOT EXISTS (SELECT 1 FROM resource_records AS evt "+
 "WHERE evt.deleted_at IS NULL "+
 "AND evt.resource_type IN ('mortality-record','flock-movement','feed','medication-administration','health-event','vaccination') "+
 "AND json_valid(evt.subject_json)=1 AND json_valid(evt.data_json)=1 "+
 "AND json_extract(evt.subject_json,'$.companyKey') = ? "+
 "AND json_extract(evt.subject_json,'$.locationKey') = ? "+
 "AND LOWER(TRIM(json_extract(evt.data_json,'$.flockCode'))) = LOWER(TRIM(?)) "+
 "AND ( "+
 " ((evt.resource_type='mortality-record' AND evt.state IN ('open','reviewed') OR evt.resource_type='flock-movement' AND evt.state='recorded' AND json_extract(evt.data_json,'$.movementType')='mortality') AND json_extract(?,'$.noneToday.mortality')=1 "+
 "  AND date(datetime(COALESCE(json_extract(evt.data_json,'$.discoveredAt'),json_extract(evt.data_json,'$.occurredAt')),'+1 hours'))=?) OR "+
 " (evt.resource_type='feed' AND evt.state='posted' AND json_extract(?,'$.noneToday.feed')=1 "+
 "  AND (json_extract(evt.data_json,'$.movementType') = 'consumed' OR json_extract(evt.data_json,'$.useType') = 'consumption') "+
 "  AND date(datetime(json_extract(evt.data_json,'$.occurredAt'),'+1 hours'))=?) OR "+
 " ((evt.resource_type='medication-administration' AND evt.state IN ('recorded','reviewed') OR evt.resource_type='health-event' AND evt.state IN ('open','resolved') AND json_extract(evt.data_json,'$.eventType')='treatment') AND json_extract(?,'$.noneToday.medication')=1 "+
 "  AND date(datetime(COALESCE(json_extract(evt.data_json,'$.administeredAt'),json_extract(evt.data_json,'$.observedAt')),'+1 hours'))=?) OR "+
 " (evt.resource_type='vaccination' AND evt.state='administered' AND json_extract(?,'$.noneToday.vaccination')=1 "+
 "  AND date(datetime(json_extract(evt.data_json,'$.administeredAt'),'+1 hours'))=?) "+
 "))";

export function dailyReportNoneTodayProofParams(record: Readonly<{
  subject: Readonly<{companyKey?:string;locationKey?:string;departmentKey?:string}>;
  data: unknown;
}>): readonly (string | number)[] {
  const data=record.data&&typeof record.data==="object"&&!Array.isArray(record.data)
    ?record.data as Record<string,unknown>:null;
  const company=record.subject.companyKey,site=record.subject.locationKey;
  if(data?.kind!=="daily-flock-report" || typeof data.flockCode!=="string" ||
     typeof data.localDate!=="string" || !company || !site){
    throw new ResourceWorkflowError("VALIDATION_FAILED",["Daily Report source scope missing"]);
  }
  const encoded=JSON.stringify(data);
  const flockId=typeof data.flockId==="string"?data.flockId:"";
  return [
    company,site,data.flockCode,
    encoded,data.localDate,encoded,data.localDate,
    encoded,data.localDate,encoded,data.localDate,
    encoded,company,site,data.flockCode,flockId,record.subject.departmentKey || "",
    data.localDate,data.localDate,data.localDate,data.localDate,
    data.localDate,data.localDate,data.localDate,data.localDate,
  ];
}

/** Every linked source event must still exist, at the exact revision the
 * reporter saw, in the same company/site/Flock/House and the same Africa/Lagos
 * day, in a genuine completed state with an offset-aware timestamp. Runs in the
 * same atomic D1 statement as the Daily Report insert/transition. Feed counts
 * only when POSTED, CONSUMED, kg and a positive quantity; no stock or cost is
 * implied. */
const TS=(key:string)=>
 "(json_type(evt.data_json,'$."+key+"')='text' AND datetime(json_extract(evt.data_json,'$."+key+"')) IS NOT NULL "+
 "AND (json_extract(evt.data_json,'$."+key+"') GLOB '*Z' OR json_extract(evt.data_json,'$."+key+"') GLOB '*[+-][0-9][0-9]:[0-9][0-9]') "+
 "AND date(datetime(json_extract(evt.data_json,'$."+key+"'),'+1 hours'))=?)";
/** Genuine provenance: the source row must be backed by the immutable audit
 * chain the resource workflow writes atomically with every mutation: a
 * `resource.created` receipt at revision 1, a receipt for every revision
 * 1..current, and the latest state-bearing receipt (created/transitioned)
 * must name the row's current state. A row inserted or advanced by any path
 * that bypassed the workflow therefore cannot back a Daily Report. */
const AUDIT_REV="CAST(json_extract(a.metadata_json,'$.revision') AS INTEGER)";
const AUDIT_BASE=
 "a.resource_id=evt.id AND a.resource_type=evt.resource_type AND json_valid(a.metadata_json)=1";
const SOURCE_AUDIT_SQL =
 "AND EXISTS (SELECT 1 FROM resource_audit_events AS a WHERE "+AUDIT_BASE+
 " AND json_extract(a.metadata_json,'$.event')='resource.created' AND "+AUDIT_REV+"=1) "+
 "AND (SELECT COUNT(DISTINCT "+AUDIT_REV+") FROM resource_audit_events AS a WHERE "+AUDIT_BASE+
 " AND json_extract(a.metadata_json,'$.event') IN ('resource.created','resource.transitioned','resource.updated') "+
 " AND "+AUDIT_REV+" BETWEEN 1 AND evt.revision)=evt.revision "+
 "AND (SELECT COALESCE(json_extract(a.metadata_json,'$.to'),json_extract(a.metadata_json,'$.state')) "+
 " FROM resource_audit_events AS a WHERE "+AUDIT_BASE+
 " AND json_extract(a.metadata_json,'$.event') IN ('resource.created','resource.transitioned') "+
 " AND "+AUDIT_REV+" <= evt.revision ORDER BY "+AUDIT_REV+" DESC LIMIT 1)=evt.state ";
const EVENT_REFS_SQL =
 "NOT EXISTS (SELECT 1 FROM json_each(?,'$.eventRefs') AS r WHERE NOT EXISTS ("+
 "SELECT 1 FROM resource_records AS evt WHERE evt.id=json_extract(r.value,'$.id') "+
 "AND evt.revision=json_extract(r.value,'$.revision') AND evt.deleted_at IS NULL "+
 "AND json_valid(evt.subject_json)=1 AND json_valid(evt.data_json)=1 "+
 "AND json_extract(evt.subject_json,'$.companyKey')=? AND json_extract(evt.subject_json,'$.locationKey')=? "+
 "AND LOWER(TRIM(json_extract(evt.data_json,'$.flockCode')))=LOWER(TRIM(?)) "+
 "AND EXISTS (SELECT 1 FROM resource_records AS fl WHERE fl.id=? AND fl.resource_type='flock' AND fl.deleted_at IS NULL AND ("+
 " (json_type(r.value,'$.sourceType') IS NULL AND (json_extract(r.value,'$.kind')='feed' OR json_extract(evt.data_json,'$.house')=json_extract(fl.data_json,'$.house'))) OR "+
 " (json_type(r.value,'$.sourceType')='text' AND json_extract(evt.data_json,'$.flockId')=fl.id AND "+
 " json_extract(fl.subject_json,'$.departmentKey')=? AND json_extract(evt.subject_json,'$.departmentKey')=json_extract(fl.subject_json,'$.departmentKey') AND "+
 " (json_type(evt.data_json,'$.housePen') IS NULL OR json_extract(evt.data_json,'$.housePen')=json_extract(fl.data_json,'$.house'))))) "+
 "AND NOT EXISTS (SELECT 1 FROM json_tree(evt.data_json) AS entry WHERE entry.key IS NOT NULL GROUP BY entry.parent, entry.key HAVING COUNT(*) > 1) "+
 SOURCE_AUDIT_SQL+
 "AND ( "+
 "(json_type(r.value,'$.sourceType') IS NULL AND json_extract(r.value,'$.kind')='mortality' AND evt.resource_type='mortality-record' AND evt.state IN ('open','reviewed') AND "+TS("discoveredAt")+") OR "+
 "(json_type(r.value,'$.sourceType') IS NULL AND json_extract(r.value,'$.kind')='medication' AND evt.resource_type='medication-administration' AND evt.state IN ('recorded','reviewed') AND "+TS("administeredAt")+") OR "+
 "(json_type(r.value,'$.sourceType') IS NULL AND json_extract(r.value,'$.kind')='vaccination' AND evt.resource_type='vaccination' AND evt.state='administered' AND "+TS("administeredAt")+") OR "+
 "(json_type(r.value,'$.sourceType') IS NULL AND json_extract(r.value,'$.kind')='feed' AND evt.resource_type='feed' AND evt.state='posted' AND json_extract(evt.data_json,'$.movementType')='consumed' "+
 " AND json_extract(evt.data_json,'$.unit')='kg' AND json_type(evt.data_json,'$.quantity') IN ('integer','real') AND json_extract(evt.data_json,'$.quantity')>0 AND "+TS("occurredAt")+") OR "+
 "(json_extract(r.value,'$.kind')='mortality' AND json_extract(r.value,'$.sourceType')='flock-movement' AND evt.resource_type='flock-movement' AND evt.state='recorded' "+
 " AND json_extract(evt.data_json,'$.movementType')='mortality' AND json_type(evt.data_json,'$.quantity')='integer' AND json_extract(evt.data_json,'$.quantity')>0 AND "+TS("occurredAt")+") OR "+
 "(json_extract(r.value,'$.kind')='medication' AND json_extract(r.value,'$.sourceType')='health-event' AND evt.resource_type='health-event' AND evt.state IN ('open','resolved') "+
 " AND json_extract(evt.data_json,'$.eventType')='treatment' AND "+TS("observedAt")+") OR "+
 "(json_extract(r.value,'$.kind')='vaccination' AND json_extract(r.value,'$.sourceType')='stage24-vaccination' AND evt.resource_type='vaccination' AND evt.state='administered' AND "+TS("administeredAt")+") OR "+
 "(json_extract(r.value,'$.kind')='feed' AND json_extract(r.value,'$.sourceType')='stage24-feed' AND evt.resource_type='feed' AND evt.state='posted' "+
 " AND json_extract(evt.data_json,'$.useType')='consumption' AND json_extract(evt.data_json,'$.unit') IN ('kg','ton') AND json_type(evt.data_json,'$.quantity') IN ('integer','real') "+
 " AND json_extract(evt.data_json,'$.quantity')>0 AND "+TS("occurredAt")+") "+
 ")))";
export const DAILY_REPORT_NONE_TODAY_PROOF_SQL = "(" + NONE_TODAY_ONLY_SQL + " AND " + EVENT_REFS_SQL + ")";

/** Request-time authority snapshot (never stored in report data or audit). */
export type DailyReportAuthority = Readonly<{ sessionId: string; accountId: string; fingerprint: string }>;

/** Atomic write-boundary revalidation, evaluated inside every Daily Report
 * INSERT/UPDATE: the session is unrevoked and unexpired, its account is active,
 * the session and account identities match, the security stamp is intact, and
 * the live role/permission/scope/status snapshot equals the one the request was
 * authorized against. A revocation at any point before the batch commits makes
 * the statement change zero rows, so no report mutation or audit receipt is
 * written. */
export const DAILY_REPORT_AUTHORITY_SQL =
 "EXISTS (SELECT 1 FROM portal_sessions AS s INNER JOIN portal_accounts AS a ON a.id = s.account_id "+
 "WHERE s.id = ? AND a.id = ? AND s.revoked_at IS NULL AND julianday(s.expires_at) IS NOT NULL AND julianday(s.expires_at) > julianday('now') AND a.status = 'active' "+
 "AND s.security_stamp = a.security_stamp AND "+PORTAL_AUTHORITY_FINGERPRINT_SQL+" = ?)";

/** Session expiry is judged by SQLite's clock at statement execution (julianday('now')),
 * not by any earlier JS timestamp; a malformed expires_at yields NULL and fails closed.
 * The optional second argument is accepted only for call-site compatibility. */
export function dailyReportAuthorityParams(authority: DailyReportAuthority | undefined, _requestNowIgnored?: string): readonly string[] {
  if(!authority || !authority.sessionId || !authority.accountId || !authority.fingerprint){
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED", ["fresh-authorization-unavailable"]);
  }
  return [authority.sessionId, authority.accountId, authority.fingerprint];
}
