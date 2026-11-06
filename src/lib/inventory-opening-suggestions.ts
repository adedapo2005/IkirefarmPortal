/**
 * Read-only, server-scoped Opening Count evidence reuse.
 * The source is the existing signed-in inventory opening-workspace endpoint.
 * These choices are conveniences, NOT master stock balances or authorizations.
 */
import type { GuidedChoice } from "./farm-guided-entry.ts";

export type OpeningEvidenceChoice = GuidedChoice & Readonly<{
  state: "draft" | "submitted" | "approved" | "cancelled";
}>;
export type OpeningEvidenceResults = Readonly<{
  choices: readonly OpeningEvidenceChoice[];
  hasMore: boolean;
}>;
const states=["draft","submitted","approved","cancelled"] as const;
const units=["unit","kg","bag","ton","litre"] as const;
const validText=(v:unknown,max:number):v is string=>
  typeof v==="string" && Boolean(v.trim()) && v.length<=max;
const record=(v:unknown):v is Record<string,unknown>=>
  Boolean(v && typeof v==="object" && !Array.isArray(v));

/** Missing or malformed authoritative results fail closed. */
export function parseOpeningEvidenceChoices(payload:unknown):OpeningEvidenceResults | null {
  if(!record(payload) || !["available","no-data"].includes(String(payload.state)) ||
      payload.source!=="Authenticated D1 opening-stock evidence register" ||
      payload.page!==0 || payload.pageSize!==16 || typeof payload.hasMore!=="boolean" ||
      !Array.isArray(payload.items) || payload.items.length>16) return null;
  const choices:OpeningEvidenceChoice[]=[];
  const seen=new Set<string>();
  for(const item of payload.items){
    if(!record(item) || !validText(item.id,160) ||
        !Number.isSafeInteger(item.revision) || Number(item.revision)<1 ||
        !states.includes(item.state as typeof states[number]) ||
        !record(item.data) || item.data.kind!=="stock-opening" ||
        !validText(item.data.itemCode,80) || !validText(item.data.locationKey,120) ||
        !units.includes(item.data.unit as typeof units[number])) return null;
    // Explicitly withhold numeric counts, notes, signatures and evidence fields.
    const itemCode=(item.data.itemCode as string).trim();
    const locationKey=(item.data.locationKey as string).trim();
    const unit=item.data.unit as string;
    const key=JSON.stringify([itemCode.toLocaleLowerCase("en-NG"),
      locationKey.toLocaleLowerCase("en-NG"),unit]);
    if(seen.has(key))continue;
    seen.add(key);
    choices.push({
      id:item.id as string,
      revision:item.revision as number,
      source:"authenticated-record",
      label:itemCode+" · "+locationKey,
      state:item.state as OpeningEvidenceChoice["state"],
      fields:{itemCode,locationKey,unit},
    });
  }
  return {choices,hasMore:payload.hasMore as boolean};
}

/**
 * Previously APPROVED opening baselines are deliberately not offered for
 * another duplicate opening count of that item/store/unit.
 */
export function canReuseOpeningEvidence(
  entry:OpeningEvidenceChoice,
):boolean {
  return entry.state!=="approved";
}

export const OPENING_REUSE_MAPPINGS = Object.freeze([
  {key:"itemCode",from:"itemCode",policy:"review" as const},
  {key:"locationKey",from:"locationKey",policy:"review" as const},
  {key:"unit",from:"unit",policy:"review" as const},
]);
