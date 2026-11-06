/**
 * Read-only WhatsApp test form checks, aligned with server-side safeguards.
 * These never authorize sending; Meta/WhatsApp APIs recheck consent and template.
 */
export type WhatsAppTestTemplate = Record<string, unknown>;

const VARIABLE_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

export function supportedTemplateVariables(template: WhatsAppTestTemplate): number[] | null {
  const components = template.components;
  if (!Array.isArray(components) || components.length > 20) return null;
  const indexes = new Set<number>();
  let hasBody = false;

  for (const rawComponent of components) {
    if (!rawComponent || typeof rawComponent !== "object" || Array.isArray(rawComponent)) continue;
    const component = rawComponent as Record<string, unknown>;
    const type = String(component.type || "").toUpperCase();
    const text = typeof component.text === "string" ? component.text : "";

    if (type === "BODY") {
      if (typeof component.text !== "string") return null;
      hasBody = true;
    }
    if (type === "HEADER" && component.format &&
        String(component.format).toUpperCase() !== "TEXT") return null;

    const matches = [...text.matchAll(VARIABLE_PATTERN)];
    const unmatched = text.replace(VARIABLE_PATTERN, "");
    if (unmatched.includes("{{") || unmatched.includes("}}")) return null;
    if (matches.length && type !== "HEADER" && type !== "BODY") return null;

    for (const match of matches) {
      const index = Number(match[1]);
      if (!Number.isInteger(index) || index < 1 || index > 10) return null;
      indexes.add(index);
    }
    if (type === "BUTTONS" && Array.isArray(component.buttons)) {
      for (const button of component.buttons) {
        if (!button || typeof button !== "object" || Array.isArray(button)) continue;
        const url = (button as Record<string, unknown>).url;
        if (typeof url === "string" && (url.includes("{{") || url.includes("}}"))) return null;
      }
    }
  }
  if (!hasBody) return null;
  const sorted = [...indexes].sort((a, b) => a - b);
  if (sorted.length > 10 || sorted.some((value, index) => value !== index + 1)) return null;
  return sorted;
}

export function approvedSupportedUtilityTemplates(templates: readonly WhatsAppTestTemplate[]) {
  return templates.filter((template) =>
    String(template.provider_status || "").toUpperCase() === "APPROVED" &&
    String(template.category || "").toUpperCase() === "UTILITY" &&
    supportedTemplateVariables(template) !== null,
  );
}


export function countApprovedWhatsAppTemplates(templates: readonly WhatsAppTestTemplate[]) {
  const approved = templates.filter((template) =>
    String(template.provider_status || "").toUpperCase() === "APPROVED",
  );
  return {
    total: approved.length,
    utility: approved.filter((template) => String(template.category || "").toUpperCase() === "UTILITY").length,
    authentication: approved.filter((template) => String(template.category || "").toUpperCase() === "AUTHENTICATION").length,
    eligibleUtility: approvedSupportedUtilityTemplates(templates).length,
  };
}

export type WhatsAppTestReadinessCheck = {
  id: string;
  title: string;
  ready: boolean;
  detail: string;
};

export function describeWhatsAppTestReadiness(input: {
  messagingAvailable: boolean;
  selectedWabaId: string;
  selectedTemplate: WhatsAppTestTemplate | null;
  recipient: string;
  parameterIndexes: number[];
  parameterValues: Record<number, string>;
  consentConfirmed: boolean;
  sending: boolean;
}) {
  const expectedVariables = input.selectedTemplate ? supportedTemplateVariables(input.selectedTemplate) : null;
  const templateChosen = input.selectedTemplate !== null
    && String(input.selectedTemplate.category || "").toUpperCase() === "UTILITY"
    && String(input.selectedTemplate.provider_status || "").toUpperCase() === "APPROVED"
    && expectedVariables !== null
    && expectedVariables.length === input.parameterIndexes.length
    && expectedVariables.every((id, index) => id === input.parameterIndexes[index]);
  const missingParameters = templateChosen
    ? input.parameterIndexes.filter((index) =>
        typeof input.parameterValues[index] !== "string" || input.parameterValues[index].trim().length === 0)
    : [];
  const recipientValid = recipientLooksValid(input.recipient);
  const checks: WhatsAppTestReadinessCheck[] = [
    {
      id: "messaging", title: "WhatsApp Messaging", ready: input.messagingAvailable,
      detail: input.messagingAvailable ? "Messaging Is Available" : "Messaging Must Be Available",
    },
    {
      id: "waba", title: "Selected Farms WABA", ready: input.selectedWabaId.trim().length > 0,
      detail: input.selectedWabaId.trim() ? "Farms WABA Is Selected" : "Select A Farms WhatsApp Business Account",
    },
    {
      id: "template", title: "Utility Template", ready: templateChosen,
      detail: templateChosen ? "An Approved Utility Template Is Selected" : "Choose An Approved Utility Template",
    },
    {
      id: "recipient", title: "Recipient Number", ready: recipientValid,
      detail: recipientValid ? "International Number Format Is Valid" : "Enter A Number With Country Code, Such As +234 801 234 5678",
    },
    {
      id: "variables", title: "Template Values", ready: templateChosen && missingParameters.length === 0,
      detail: !templateChosen
        ? "Choose A Template To See Required Values"
        : missingParameters.length > 0
          ? "Complete " + missingParameters.length + " Missing Template Value" + (missingParameters.length === 1 ? "" : "s")
          : input.parameterIndexes.length === 0 ? "This Template Needs No Values" : "All Required Template Values Are Complete",
    },
    {
      id: "consent", title: "Recipient Consent", ready: input.consentConfirmed,
      detail: input.consentConfirmed ? "Recipient Consent Confirmed" : "Confirm The Recipient Has Agreed To This Test",
    },
  ];
  return {
    checks,
    remaining: checks.filter((check) => !check.ready).length,
    canReview: checks.every((check) => check.ready) && !input.sending,
  };
}


export function recipientLooksValid(value: string) {
  const cleaned = value.trim();
  if (!cleaned.startsWith("+") || !/^\+[0-9\s().-]+$/.test(cleaned)) return false;
  return /^[1-9]\d{7,14}$/.test(cleaned.slice(1).replace(/[\s().-]/g, ""));
}
