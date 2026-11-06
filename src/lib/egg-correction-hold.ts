// Temporary fail-closed hold until correction balance, authorization and
// legacy coverage can be enforced at the write boundary.
export class EggCorrectionHold extends Error {}
export function holdEggCorrectionWrites(kind: string): void {
  if (kind === "egg-batch-adjustment") throw new EggCorrectionHold();
}
export const EGG_CORRECTION_HOLD = Object.freeze({
  error: "EGG_CORRECTION_TEMPORARILY_UNAVAILABLE",
  message: "Egg corrections and changes to egg batches are temporarily unavailable. Existing records remain available. Contact your administrator.",
});
