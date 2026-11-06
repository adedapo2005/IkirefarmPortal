const protectedTerms: Record<string, string> = {
  api: "API",
  erp: "ERP",
  hr: "HR",
  rfq: "RFQ",
  po: "PO",
  pwa: "PWA",
  oauth: "OAuth",
  google: "Google",
  microsoft: "Microsoft",
  daenem: "Daenem",
};

const minorWords = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "vs", "with"]);

/** Title Case for interface labels. Raw values, URLs, identifiers and user content must not use this helper. */
export function titleCase(value: string) {
  return value
    .split(/(\s+|\/|·|—|–|:)/)
    .map((part, index, all) => {
      if (!part || /^(\s+|\/|·|—|–|:)$/.test(part)) return part;
      if (/^[A-Z0-9][A-Z0-9-]*$/.test(part) && part.length > 1) return part;
      const clean = part.toLowerCase();
      if (protectedTerms[clean]) return protectedTerms[clean];
      const isBoundary = index === 0 || index === all.length - 1 || ["/", "·", "—", "–", ":"].includes(all[index - 1]);
      if (!isBoundary && minorWords.has(clean)) return clean;
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    })
    .join("");
}

export const canonicalTerminology = {
  supplier: "Supplier",
  provider: "Provider",
  contractor: "Contractor",
  customer: "Customer",
  farmSite: "Farm / Site",
  businessUnit: "Business Unit",
  purchaseOrder: "Purchase Order",
  requestForQuotation: "RFQ",
} as const;

