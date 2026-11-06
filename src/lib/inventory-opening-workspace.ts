import type { AuthenticatedPrincipal } from "./authenticated-principal.ts";
import { authorize } from "./security-authority.ts";
import { ResourceWorkflowError } from "./resource-workflow.ts";
import { listInventoryProcurement } from "./inventory-procurement-api.ts";

/** Auditable baseline evidence; it never claims current stock-on-hand. */
export type OpeningHistoryQuery = Readonly<{
  page?: number;
  status?: "all" | "draft" | "submitted" | "approved" | "cancelled";
  query?: string;
}>;
const OPENING_PAGE_SIZE=16;

export async function getInventoryOpeningWorkspace(
  db: D1Database,
  principal: AuthenticatedPrincipal,
  options: OpeningHistoryQuery = {},
) {
  const page=options.page??0;
  const status=options.status??"all";
  const query=(options.query??"").trim().toLocaleLowerCase("en-NG");
  if (!Number.isSafeInteger(page) || page<0 || page>625 ||
      !["all","draft","submitted","approved","cancelled"].includes(status) ||
      (options.query??"").length>100) {
    throw new ResourceWorkflowError("VALIDATION_FAILED",["Invalid opening-stock history filter"]);
  }
  const scope=principal.organizationScope;
  const isOwner=principal.isOwner && principal.accessState==="owner";
  if (!scope?.companyKey || !scope?.locationKey || !principal.farmAuthorized ||
      principal.restriction==="disabled" ||
      (!isOwner && (!principal.permissions.includes("inventory.view") ||
        !principal.permissionScopes["inventory.view"]))) {
    throw new ResourceWorkflowError("AUTHORIZATION_DENIED");
  }

  const records=await listInventoryProcurement(db,principal,"stock-opening");
  const totals={draft:0,submitted:0,approved:0,cancelled:0};
  for (const record of records) {
    if (record.data.kind!=="stock-opening" ||
        !["draft","submitted","approved","cancelled"].includes(record.state)) {
      // A malformed count is not a verified quantity or state. Fail closed.
      throw new Error("INVENTORY_OPENING_WORKSPACE_INVALID_RECORD");
    }
    totals[record.state as keyof typeof totals]++;
  }
  // Authorization and tenant/site isolation happen before text filtering and
  // paging. Never derive visible counts from another worker's first 200 rows.
  const matching=records.filter(record=>{
    if(record.data.kind!=="stock-opening")return false;
    if(status!=="all" && record.state!==status)return false;
    if(!query)return true;
    const d=record.data;
    return [d.itemCode,d.locationKey,d.sourceReference]
      .some(value=>value.toLocaleLowerCase("en-NG").includes(query));
  });
  const start=page*OPENING_PAGE_SIZE;
  const visiblePage=matching.slice(start,start+OPENING_PAGE_SIZE);
  const allowed=(action:"edit"|"approve",record:typeof records[number])=>
    authorize(principal,{
      channel:"api",action,permission:"inventory.edit",subject:record.subject,
      ...(action==="approve"?{approvalPermission:"inventory.approve"}:{}),
    }).allowed;
  return {
    state:records.length?"available" as const:"no-data" as const,
    asOf:new Date().toISOString(),
    source:"Authenticated D1 opening-stock evidence register",
    totals,
    page,
    pageSize:OPENING_PAGE_SIZE,
    totalMatched:matching.length,
    hasPrevious:page>0,
    items:visiblePage.map(record=>({
      id:record.id,state:record.state,revision:record.revision,
      createdBy:record.createdBy??null,
      data:record.data,
      actions:{
        submit:record.state==="draft" && allowed("edit",record),
        cancel:["draft","submitted"].includes(record.state) && allowed("edit",record),
        approve:record.state==="submitted" && Boolean(record.createdBy) &&
          record.createdBy!==principal.id && allowed("approve",record),
      },
    })),
    hasMore:start+OPENING_PAGE_SIZE<matching.length,
    warning:"An approved opening count is historical evidence, not live stock-on-hand. Reconciled receipts, issues, signed adjustments and transfer destinations are required first.",
  };
}
