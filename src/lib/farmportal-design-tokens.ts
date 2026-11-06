/**
 * FarmPortal-only reference-led visual semantics (Issue #105).
 * This is a shared design contract, not an app-wide forced theme override.
 * Components adopt it incrementally with visual acceptance.
 */
export const farmPortalDesignTokens = Object.freeze({
  brand: Object.freeze({
    navigation: "#008751",
    navigationSelected: "#00A86B",
    emerald: "#12B76A",
    leaf: "#19C37D",
  }),
  accents: Object.freeze({
    teal: "#0D9488",
    intelligence: "#6554D9",
    operationsAttention: "#F97316",
    information: "#2563EB",
    warning: "#F5A524",
    critical: "#D92D20",
  }),
  surfaces: Object.freeze({
    mineralWhite: "#F8FAF8",
    white: "#FFFFFF",
    warmIvory: "#FFFCF5",
    mintMist: "#EAF8EF",
  }),
  ink: Object.freeze({
    primary: "#18372D",
    secondary: "#475467",
    inputPlaceholder: "#60796A",
  }),
});

export const farmPortalColourRoles = Object.freeze({
  navigation: "brand.navigation",
  selectedNavigation: "brand.navigationSelected",
  positive: "brand.emerald",
  pendingReview: "accents.operationsAttention",
  informational: "accents.information",
  exploratoryIntelligence: "accents.intelligence",
  operationalTracking: "accents.teal",
  critical: "accents.critical",
  focusRing: "accents.information",
});

/** No generic direction-based good/bad assignment for changing metrics. */
export function metricChangeMeaning(
  absoluteChange: number | null,
  lowerIsBetter: boolean | null,
): "favourable" | "unfavourable" | "neutral" | "unverified" {
  if (absoluteChange === null || !Number.isFinite(absoluteChange) || lowerIsBetter === null) return "unverified";
  if (absoluteChange === 0) return "neutral";
  return (absoluteChange < 0) === lowerIsBetter ? "favourable" : "unfavourable";
}
