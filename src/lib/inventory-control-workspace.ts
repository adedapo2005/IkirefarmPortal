import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";

type StockRow = {
  id: string;
  resource_type: string;
  state: string;
  subject_json: string;
  data_json: string;
  revision: number;
  updated_at: string | null;
};
type MovementType = "receipt" | "issue" | "adjustment" | "transfer";
type StockUnit = "unit" | "kg" | "bag" | "ton" | "litre";
const types: readonly MovementType[] = ["receipt", "issue", "adjustment", "transfer"];
const units: readonly StockUnit[] = ["unit", "kg", "bag", "ton", "litre"];
const PAGE_SIZE = 200;
const MAX_SCANNED = 10000;
const hasRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const validName = (value: unknown, maximum=120): value is string =>
  typeof value === "string" && Boolean(value.trim()) && value.length <= maximum;

type Movement = {
  id: string;
  state: "draft" | "posted" | "voided";
  itemCode: string;
  locationKey: string;
  movementType: MovementType;
  quantity: number;
  unit: StockUnit;
  occurredAt: string;
  hasSupportingReference: boolean;
  updatedAt: string | null;
};
type Flow = {
  itemCode: string;
  locationKey: string;
  unit: StockUnit;
  postedReceiptQuantity: number;
  postedIssueQuantity: number;
  postedAdjustments: number;
  postedTransfers: number;
  recordedMovements: number;
};

/**
 * Scope and aggregate the actual authorized stock-movement register.
 * Deliberately does NOT calculate current stock balances, reorder thresholds,
 * inventory valuations or cross-unit quantities: the current contract lacks
 * opening balances, adjustment sign/destination and complete stock snapshots.
 */
export async function getInventoryControlWorkspace(db: D1Database, principal: AuthenticatedPrincipal) {
  const scope = principal.organizationScope;
  const owner = principal.isOwner && principal.accessState === "owner";
  if (!scope?.companyKey || !scope?.locationKey || !principal.farmAuthorized ||
      principal.restriction === "disabled" ||
      (!owner && (!principal.permissions.includes("inventory.view") ||
        !principal.permissionScopes["inventory.view"]))) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }
  const sql =
    "SELECT id, resource_type, state, revision, subject_json, data_json, updated_at " +
    "FROM resource_records WHERE resource_type = 'stock-movement' AND deleted_at IS NULL " +
    "AND json_extract(subject_json, '$.companyKey') = ? " +
    "AND json_extract(subject_json, '$.locationKey') = ? " +
    "ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?";

  const recent: Movement[] = [];
  const flows = new Map<string, Flow>();
  const totals = {
    recorded: 0,
    draft: 0,
    posted: 0,
    voided: 0,
    pendingAdjustments: 0,
    postedWithoutReference: 0,
    postedReceipts: 0,
    postedIssues: 0,
    postedAdjustments: 0,
    postedTransfers: 0,
  };
  for (let offset=0;;offset+=PAGE_SIZE) {
    const result=await db.prepare(sql).bind(scope.companyKey,scope.locationKey,PAGE_SIZE,offset).all<StockRow>();
    const page=result.results ?? [];
    if (offset + page.length > MAX_SCANNED) {
      // Never return an incomplete metric as a verified value.
      throw new Error("INVENTORY_WORKSPACE_RECORD_LIMIT");
    }
    for (const row of page) {
      if (!row || row.resource_type !== "stock-movement" || typeof row.id !== "string" ||
          typeof row.subject_json !== "string" || typeof row.data_json !== "string") {
        throw new Error("INVENTORY_WORKSPACE_INVALID_RECORD");
      }
      let subject: unknown, payload: unknown;
      try { subject=JSON.parse(row.subject_json);payload=JSON.parse(row.data_json); }
      catch { throw new Error("INVENTORY_WORKSPACE_INVALID_JSON"); }
      if (!hasRecord(subject) || !hasRecord(payload)) throw new Error("INVENTORY_WORKSPACE_INVALID_RECORD");
      if (subject.companyKey !== scope.companyKey || subject.locationKey !== scope.locationKey) continue;
      if (!authorize(principal,{
        channel:"api",action:"view",permission:"inventory.view",
        subject:subject as AuthorizationSubject,
      }).allowed) continue;
      if (payload.kind !== "stock-movement" ||
          !validName(payload.itemCode,80) || !validName(payload.locationKey) ||
          !types.includes(payload.movementType as MovementType) ||
          !units.includes(payload.unit as StockUnit) ||
          typeof payload.quantity !== "number" || !Number.isFinite(payload.quantity) ||
          payload.quantity <= 0 || !validName(payload.occurredAt,64) ||
          !Number.isFinite(Date.parse(payload.occurredAt)) ||
          !["draft","posted","voided"].includes(row.state)) {
        throw new Error("INVENTORY_WORKSPACE_INVALID_STOCK_DATA");
      }
      if (payload.evidenceIds!==undefined && (!Array.isArray(payload.evidenceIds) ||
          payload.evidenceIds.some((e:unknown)=>typeof e!=="string"))) {
        throw new Error("INVENTORY_WORKSPACE_INVALID_EVIDENCE");
      }
      if (payload.sourceReference!==undefined && typeof payload.sourceReference!=="string") {
        throw new Error("INVENTORY_WORKSPACE_INVALID_REFERENCE");
      }
      const referenced =
        (typeof payload.sourceReference==="string" && Boolean(payload.sourceReference.trim())) ||
        (Array.isArray(payload.evidenceIds) && payload.evidenceIds.length>0);
      const m: Movement = {
        id:row.id,state:row.state as Movement["state"],
        itemCode:payload.itemCode.trim() as string,
        locationKey:payload.locationKey.trim() as string,
        movementType:payload.movementType as MovementType,
        quantity:payload.quantity,unit:payload.unit as StockUnit,
        occurredAt:payload.occurredAt as string,
        hasSupportingReference:referenced,
        updatedAt:typeof row.updated_at==="string" && Number.isFinite(Date.parse(row.updated_at))
          ? row.updated_at : null,
      };
      totals.recorded++;
      if (recent.length<8) recent.push(m);
      if (m.state==="draft") {
        totals.draft++;
        if (m.movementType==="adjustment") totals.pendingAdjustments++;
      } else if(m.state==="voided") {
        totals.voided++;
      } else {
        totals.posted++;
        if(!referenced) totals.postedWithoutReference++;
        if(m.movementType==="receipt") totals.postedReceipts++;
        if(m.movementType==="issue") totals.postedIssues++;
        if(m.movementType==="adjustment") totals.postedAdjustments++;
        if(m.movementType==="transfer") totals.postedTransfers++;
        const key=JSON.stringify([m.itemCode,m.locationKey,m.unit]);
        let flow=flows.get(key);
        if(!flow){
          flow={
            itemCode:m.itemCode,locationKey:m.locationKey,unit:m.unit,
            postedReceiptQuantity:0,postedIssueQuantity:0,
            postedAdjustments:0,postedTransfers:0,recordedMovements:0,
          };
          flows.set(key,flow);
        }
        flow.recordedMovements++;
        if(m.movementType==="receipt") flow.postedReceiptQuantity+=m.quantity;
        if(m.movementType==="issue") flow.postedIssueQuantity+=m.quantity;
        if(m.movementType==="adjustment") flow.postedAdjustments++;
        if(m.movementType==="transfer") flow.postedTransfers++;
        if (!Number.isFinite(flow.postedReceiptQuantity)||!Number.isFinite(flow.postedIssueQuantity)) {
          throw new Error("INVENTORY_WORKSPACE_QUANTITY_OVERFLOW");
        }
      }
    }
    if(page.length<PAGE_SIZE)break;
  }
  const activity=Array.from(flows.values()).sort(
    (a,b)=>b.recordedMovements-a.recordedMovements || a.itemCode.localeCompare(b.itemCode,"en-NG"),
  ).slice(0,6);
  return {
    state:totals.recorded?"available" as const:"no-data" as const,
    source:"Authenticated Cloudflare D1 stock movement records",
    asOf:new Date().toISOString(),
    totals,
    activity,
    recent,
    dataQuality:{
      balanceVerified:false,
      reorderThresholdsVerified:false,
      valuationVerified:false,
      note:"These are authorised stock movement records, not current stock balances. Opening stock, signed adjustments, transfer destinations and valuation are not established.",
    },
  };
}
