/**
 * FarmPortal WhatsApp AUTHENTICATION template payloads.
 * Meta's approved Copy Code template requires the OTP in both the body
 * parameter and the dynamic URL button parameter. Never log OTPs.
 */
export function buildWhatsAppAuthenticationComponents(code: string, components: unknown) {
  if (!/^\d{6}$/.test(code)) throw new Error("WHATSAPP_AUTH_CODE_INVALID");
  if (!Array.isArray(components) || components.length > 20) throw new Error("WHATSAPP_AUTH_TEMPLATE_UNSUPPORTED");
  const body = components.find((item) => item && typeof item === "object"
    && String((item as Record<string, unknown>).type).toUpperCase() === "BODY") as Record<string, unknown> | undefined;
  const buttons = components.find((item) => item && typeof item === "object"
    && String((item as Record<string, unknown>).type).toUpperCase() === "BUTTONS") as Record<string, unknown> | undefined;
  const rows = buttons?.buttons;
  const button = Array.isArray(rows) && rows.length === 1 ? rows[0] as Record<string, unknown> : null;
  const url = typeof button?.url === "string" ? button.url : "";
  if (!body || typeof body.text !== "string" || !/\{\{\s*1\s*\}\}/.test(body.text)
    || !button || String(button.type).toUpperCase() !== "URL"
    || !/^https:\/\/www\.whatsapp\.com\/otp\/code\//.test(url)) {
    throw new Error("WHATSAPP_AUTH_COPY_CODE_TEMPLATE_REQUIRED");
  }
  return [
    { type: "body", parameters: [{ type: "text", text: code }] },
    { type: "button", sub_type: "url", index: "0",
      parameters: [{ type: "text", text: code }] },
  ];
}
