/**
 * Isolated deterministic model for Home's non-authoritative Quick Calculator.
 * Never use these screen-level values as an accounting ledger or posted payment.
 */
export type CalculatorOperator = "+" | "−" | "×" | "÷";
export type CalculatorState = {
  display: string;
  stored: number | null;
  operator: CalculatorOperator | null;
  replace: boolean;
};
export type CalculatorAction =
  | { type: "digit"; value: string }
  | { type: "operator"; value: CalculatorOperator }
  | { type: "equals" }
  | { type: "clear" };

export const initialCalculatorState: CalculatorState = {
  display: "0",
  stored: null,
  operator: null,
  replace: true,
};

const failed = (message: string): CalculatorState => ({
  ...initialCalculatorState,
  display: message,
});

function evaluate(left: number, right: number, operator: CalculatorOperator): number | string {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return "Result Unavailable";
  if (operator === "÷" && right === 0) return "Cannot Divide By Zero";
  const result = operator === "+" ? left + right :
    operator === "−" ? left - right :
    operator === "×" ? left * right : left / right;
  if (!Number.isFinite(result)) return "Result Unavailable";
  // Distinguish numerical underflow from an actual zero. A false zero can
  // materially mislead operational comparisons and quantity calculations.
  if (result === 0 && left !== 0 && right !== 0 &&
      (operator === "×" || operator === "÷")) return "Result Unavailable";
  // JS cannot represent integers above MAX_SAFE_INTEGER exactly.
  if (Number.isInteger(result) && !Number.isSafeInteger(result)) return "Result Unavailable";
  // Safe integer results must remain exact, including 15-digit totals.
  if (Number.isSafeInteger(result)) return result;
  // Clean up ordinary binary floating noise (0.1 + 0.2), but do not discard
  // representable fractional detail at larger magnitudes or tiny values.
  const rounded = Number(result.toPrecision(15));
  return Math.abs(rounded - result) <= Number.EPSILON * Math.abs(result) ? rounded : result;
}

export function applyCalculatorAction(state: CalculatorState, action: CalculatorAction): CalculatorState {
  if (action.type === "clear") return { ...initialCalculatorState };
  if (action.type === "digit") {
    const digit = action.value;
    if (!/^[0-9.]$/.test(digit)) return state;
    if (digit === "." && state.display.includes(".") && !state.replace) return state;
    const display = state.replace ? (digit === "." ? "0." : digit) :
      state.display === "0" && digit !== "." ? digit : `${state.display}${digit}`.slice(0, 14);
    return { ...state, display, replace: false };
  }
  const current = Number(state.display);
  if (!Number.isFinite(current)) {
    // Error labels must never be recycled into numeric state as NaN.
    return { ...initialCalculatorState };
  }
  if (action.type === "operator") {
    if (state.stored !== null && state.operator !== null && !state.replace) {
      const calculated = evaluate(state.stored, current, state.operator);
      return typeof calculated === "string"
        ? failed(calculated)
        : { display: String(calculated), stored: calculated, operator: action.value, replace: true };
    }
    return { ...state, stored: current, operator: action.value, replace: true };
  }
  if (state.stored === null || state.operator === null) return state;
  const result = evaluate(state.stored, current, state.operator);
  return typeof result === "string" ? failed(result) : { ...initialCalculatorState, display: String(result) };
}
