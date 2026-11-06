/**
 * Stage 25 canonical resource-data equality for confirmed create/update.
 *
 * Check ONLY approved fields from the request. Never transfer raw response
 * data, private server columns, audit actors, or arbitrary attributes into
 * the user-facing feedback. No JSON.stringify-based key ordering ambiguity.
 */
const object = (v:unknown):v is Record<string,unknown> =>
  v!==null && typeof v==="object" && !Array.isArray(v);

const equalScalarOrStringArray=(actual:unknown,expected:unknown):boolean=>{
  if(expected===undefined) return actual===undefined;
  if(typeof expected==="string" || typeof expected==="number" || typeof expected==="boolean"){
    return Object.is(actual,expected);
  }
  if(Array.isArray(expected)){
    return Array.isArray(actual) &&
      actual.length===expected.length &&
      expected.every((item,index)=>typeof item==="string" && actual[index]===item);
  }
  return false; // no nested client object can be a verified mutation field
};

/**
 * The contract fixes what "Saved" means: every submitted field must appear
 * in the canonical returned resource with the same typed value.
 * Optional omitted keys must remain omitted. Unknown extra response fields
 * are deliberately ignored and never displayed.
 */
export function matchesSubmittedRecord(
  actual:unknown,
  expected:unknown,
  allowedKeys:readonly string[],
):boolean{
  if(!object(actual) || !object(expected) || !allowedKeys.length)return false;
  if(Object.keys(expected).some(key=>!allowedKeys.includes(key)))return false;
  if(allowedKeys.some(key=>!Object.prototype.hasOwnProperty.call(expected,key)))return false;
  return allowedKeys.every(key=>equalScalarOrStringArray(actual[key],expected[key]));
}

export const HOUSE_FIELDS=[
  "kind","houseCode","name","housingSystem","capacityBirds","zone",
  "readinessStatus","sanitationStatus","lastSanitizedOn","source",
  "notes","evidenceIds",
] as const;

export const BREED_FIELDS=[
  "kind","breedCode","name","species","productionClass",
  "source","notes","evidenceIds",
] as const;
