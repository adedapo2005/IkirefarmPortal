/** Interim service hold, not a balance-verification implementation or writer fence. */
export class StockMovementRemovalHold extends Error {
  readonly code = "STOCK_MOVEMENT_REMOVAL_ON_HOLD";
  constructor() {
    super("Stock movement voiding and deletion are temporarily unavailable.");
    this.name = "StockMovementRemovalHold";
  }
}
