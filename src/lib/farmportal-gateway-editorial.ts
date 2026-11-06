/**
 * FarmPortal Owner-controlled public Sign-In editorial workflow.
 * Drafts never become public without an explicit Owner publish action.
 * Revision checks prevent stale browser tabs replacing newly accepted copy.
 */
import type { GatewayCardKind } from "./farmportal-gateway-content.ts";
type D1 = Pick<D1Database,"prepare">;
type FieldName = "title" | "body" | "message" | "attribution" | "theme";
type DraftInput = Readonly<{ kind: GatewayCardKind; title: string; body: string;
  message: string; attribution: string; theme: string }>;
export type EditResult = { id: string; revision: number; status: string };
const limits: Record<FieldName,number> = { title: 250, body: 1000, message: 450, attribution: 140, theme: 120 };
const clean = (raw: unknown, field: FieldName) => {
  if (raw === null || raw === undefined) return "";
  if (typeof raw !== "string") throw new Error("INVALID_CONTENT_FIELD");
  const value = raw.trim().replace(/\r/g,"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"");
  if (value.length > limits[field]) throw new Error("CONTENT_TOO_LONG");
  return value;
};
export function validateGatewayDraft(value: unknown): DraftInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_CONTENT");
  const data = value as Record<string,unknown>;
  if (data.kind !== "spotlight" && data.kind !== "inspiration") throw new Error("INVALID_CONTENT_KIND");
  const draft = {
    kind: data.kind as GatewayCardKind,
    title: clean(data.title,"title"), body: clean(data.body,"body"),
    message: clean(data.message,"message"), attribution: clean(data.attribution,"attribution"),
    theme: clean(data.theme,"theme"),
  };
  if (draft.kind === "spotlight" && !draft.title) throw new Error("SPOTLIGHT_TITLE_REQUIRED");
  if (draft.kind === "inspiration" && !draft.message) throw new Error("INSPIRATION_MESSAGE_REQUIRED");
  return draft;
}
function checkRevision(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 2_000_000_000) throw new Error("INVALID_REVISION");
  return Number(value);
}
function checkId(value: unknown) {
  if (typeof value !== "string" || !/^gw_[A-Za-z0-9_-]{24}$/.test(value)) throw new Error("INVALID_CONTENT_ID");
  return value;
}
const newId = () => {
  const bytes=new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let s="";
  for (const b of bytes) s+=String.fromCharCode(b);
  return "gw_"+btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
};
export async function createGatewayDraft(db: D1, value: unknown, now=new Date()): Promise<EditResult> {
  const d=validateGatewayDraft(value);
  const id=newId(),time=now.toISOString();
  await db.prepare(
    "INSERT INTO farmportal_gateway_content " +
    "(id,kind,title,body,message,attribution,theme,status,created_at,updated_at,revision) " +
    "VALUES (?,?,?,?,?,?,?,'draft',?,?,1)",
  ).bind(id,d.kind,d.title,d.body,d.message,d.attribution,d.theme,time,time).run();
  return {id,revision:1,status:"draft"};
}
export async function reviseGatewayDraft(db: D1, id: unknown, expectedRevision: unknown, value: unknown, now=new Date()): Promise<EditResult> {
  const key=checkId(id),rev=checkRevision(expectedRevision),d=validateGatewayDraft(value);
  const changed=await db.prepare(
    "UPDATE farmportal_gateway_content SET title=?, body=?, message=?, attribution=?, theme=?, " +
    "updated_at=?, revision=revision+1 WHERE id=? AND kind=? AND status='draft' AND revision=?",
  ).bind(d.title,d.body,d.message,d.attribution,d.theme,now.toISOString(),key,d.kind,rev).run();
  if (Number(changed.meta?.changes||0)!==1) throw new Error("STALE_OR_UNAVAILABLE_DRAFT");
  return {id:key,revision:rev+1,status:"draft"};
}
export async function publishGatewayDraft(db: D1, id: unknown, expectedRevision: unknown, ownerId: string, now=new Date()): Promise<EditResult> {
  const key=checkId(id),rev=checkRevision(expectedRevision);
  if (!/^usr_[A-Za-z0-9_-]{3,}$/.test(ownerId)) throw new Error("OWNER_AUTHORITY_INVALID");
  const time=now.toISOString();
  const changed=await db.prepare(
    "UPDATE farmportal_gateway_content SET status='published', approved_by=?, approved_at=?, " +
    "published_at=?, updated_at=?, revision=revision+1 WHERE id=? AND status='draft' " +
    "AND revision=? AND ((kind='spotlight' AND LENGTH(TRIM(COALESCE(title,'')))>0) " +
    "OR (kind='inspiration' AND LENGTH(TRIM(COALESCE(message,'')))>0))",
  ).bind(ownerId,time,time,time,key,rev).run();
  if (Number(changed.meta?.changes||0)!==1) throw new Error("STALE_OR_UNAVAILABLE_DRAFT");
  return {id:key,revision:rev+1,status:"published"};
}
export async function archiveGatewayCard(db: D1, id: unknown, expectedRevision: unknown, now=new Date()): Promise<EditResult> {
  const key=checkId(id),rev=checkRevision(expectedRevision);
  const changed=await db.prepare(
    "UPDATE farmportal_gateway_content SET status='archived', updated_at=?, revision=revision+1 " +
    "WHERE id=? AND status IN ('draft','published') AND revision=?",
  ).bind(now.toISOString(),key,rev).run();
  if (Number(changed.meta?.changes||0)!==1) throw new Error("STALE_OR_UNAVAILABLE_CONTENT");
  return {id:key,revision:rev+1,status:"archived"};
}
export async function listGatewayOwnerContent(db: D1) {
  const rows=await db.prepare(
    "SELECT id,kind,title,body,message,attribution,theme,status,revision,published_at,updated_at " +
    "FROM farmportal_gateway_content ORDER BY updated_at DESC, id DESC LIMIT 100",
  ).all();
  return rows.results||[];
}
