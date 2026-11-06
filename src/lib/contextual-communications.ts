import type { Persona } from "./portal-model";
import { COMMUNICATION_PERMISSIONS, canSend, hasCommunicationPermission, whatsappAccountFixture } from "./communications-core";

export type ContextualCommunicationDomain = "customer_sales" | "employee_hr" | "construction" | "procurement" | "owner_alert" | "recruitment" | "logistics" | "finance";
export type ContextualCommunicationUseCase = Readonly<{
  id: string;
  domain: ContextualCommunicationDomain;
  label: string;
  audience: string;
  defaultMode: "manual" | "review_first" | "automatic_when_approved";
  requiredPermission: string;
  examples: readonly string[];
}>;

export const CONTEXTUAL_WHATSAPP_USE_CASES: readonly ContextualCommunicationUseCase[] = Object.freeze([
  { id:"customer-order-update", domain:"customer_sales", label:"Contact Customer", audience:"Customer", defaultMode:"review_first", requiredPermission:"communications.initiate", examples:["Order confirmation","Order ready","Delivery update","Payment reminder","Receipt / payment confirmation","Follow-up"] },
  { id:"employee-notice", domain:"employee_hr", label:"Notify Employee", audience:"Employee", defaultMode:"review_first", requiredPermission:"hr.communications.view", examples:["Shift / attendance notice","Leave decision","Required document","Training reminder","Important notice"] },
  { id:"construction-contact", domain:"construction", label:"Contact Artisan / Supplier", audience:"Artisan or Supplier", defaultMode:"review_first", requiredPermission:"construction.view", examples:["Payment / outstanding notice","Request receipt or evidence","Material delivery confirmation","Work-status request"] },
  { id:"procurement-supplier", domain:"procurement", label:"Contact Supplier", audience:"Supplier", defaultMode:"review_first", requiredPermission:"procurement.view", examples:["RFQ","Purchase order notice","Delivery reminder","Shortage / discrepancy query"] },
  { id:"owner-alert", domain:"owner_alert", label:"Notify Owner / Admin", audience:"Owner or Admin", defaultMode:"automatic_when_approved", requiredPermission:"alerts.view", examples:["Critical system issue","Financial exception","Security event","Failed integration"] },
  { id:"recruitment-candidate", domain:"recruitment", label:"Contact Candidate", audience:"Candidate", defaultMode:"review_first", requiredPermission:"hr.recruitment.view", examples:["Interview invitation","Interview reminder","Document request","Status update","Onboarding instruction"] },
  { id:"delivery-contact", domain:"logistics", label:"Contact Customer / Driver", audience:"Customer or Driver", defaultMode:"review_first", requiredPermission:"communications.initiate", examples:["Dispatch notice","ETA update","Delivery confirmation"] },
  { id:"finance-contact", domain:"finance", label:"Send Finance Notice", audience:"Authorized Customer / Supplier / Employee", defaultMode:"review_first", requiredPermission:"finance.view", examples:["Invoice notice","Payment reminder","Approved payment notice","Outstanding balance request"] },
]);

export function contextualUseCase(id: string) { return CONTEXTUAL_WHATSAPP_USE_CASES.find((item) => item.id === id) || null; }

export function canPrepareContextualWhatsApp(person: Persona, useCase: ContextualCommunicationUseCase) {
  if (!hasCommunicationPermission(person, COMMUNICATION_PERMISSIONS.view)) return false;
  if (!hasCommunicationPermission(person, COMMUNICATION_PERMISSIONS.initiate)) return false;
  if (!hasCommunicationPermission(person, useCase.requiredPermission)) return false;
  return true;
}

export function contextualWhatsAppState(person: Persona, useCase: ContextualCommunicationUseCase) {
  if (!canPrepareContextualWhatsApp(person, useCase)) return { available:false, canSend:false, reason:"Not available in your authorized scope." } as const;
  const providerReady = whatsappAccountFixture.providerState === "ready";
  const sendAllowed = providerReady && canSend(person, "whatsapp");
  return {
    available:true,
    canSend:sendAllowed,
    reason: sendAllowed ? "Ready for governed WhatsApp delivery." : "Draft/review available. WhatsApp provider or send permission is not yet ready.",
  } as const;
}

export function contextualDraftSummary(useCase: ContextualCommunicationUseCase, recordLabel: string, recordId?: string) {
  return `${useCase.label} · ${recordLabel}${recordId ? ` · ${recordId}` : ""}`;
}