"use client";

import {
  Activity, BookOpen, CheckCircle2, ChevronRight, CircleHelp, Copy, Database, ExternalLink,
  EyeOff, FileKey2, Globe2, KeyRound, Link2, LockKeyhole, MessageSquare, Phone, RefreshCw,
  Save, Settings2, ShieldCheck, Smartphone, TriangleAlert, Webhook, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import LoggedTimestamp from "./LoggedTimestamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { META_FIELD_DEFINITIONS, META_HELP_REGISTRY, META_OPERATION_HELP_REGISTRY, type MetaHelpRecord } from "@/lib/meta-help-registry";
import MetaWhatsAppTestMessage from "./MetaWhatsAppTestMessage";
import CommunicationsActivityPanel from "./CommunicationsActivityPanel";
import styles from "./meta-provider-control-plane.module.css";

type CredentialState = { configured: boolean; validationState: string; fingerprint: string | null; updatedAt: string | null; lastValidatedAt: string | null; updatedBy: string | null };
type Snapshot = {
  state: string; version: number; configuration: Record<string, string>; credentials: Record<string, CredentialState>;
  products: Record<string, boolean>; capabilities: Array<{ key: string; state: string; reason: string }>;
  webhook: { callbackUrl: string | null; getVerification: string; postSignatureVerification: string; postOperationalProcessing: string; subscription: string };
  templates: Array<Record<string, unknown>>; audit: Array<Record<string, unknown>>;
  wabas: Array<Record<string, unknown>>; senders: Array<Record<string, unknown>>;
  mappings: Array<Record<string, unknown>>; authPolicies: Array<Record<string, unknown>>;
  health: Array<Record<string, unknown>>;
};

type OwnerApprovalIntent = {
  method: "PUT" | "POST" | "DELETE";
  path: string;
  payload: Record<string, unknown> | null;
  action: string;
  resolve: (token: string | null) => void;
};

type DiagnosticLogEntry = {
  id: string;
  action: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  startedAt: string;
  status: "running" | "success" | "failure";
  httpStatus?: number;
  durationMs?: number;
  code?: string;
  detail: string;
};

function safeDiagnosticText(value: unknown) {
  return String(value ?? "UNKNOWN")
    .replace(/(bearer|token|secret|verify_token|password|authorization)\s*[:=]?\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/EA[A-Za-z0-9_-]{12,}/g, "[REDACTED_TOKEN]")
    .slice(0, 240);
}

function explicitlySelectedAssetId(rows: Array<Record<string, unknown>>) {
  const selected = rows.find((row) => row.selected === true || row.selected === 1 || row.selected === "1");
  return String(selected?.id || selected?.provider_waba_id || selected?.provider_phone_number_id || "");
}

function diagnosticResultDetail(path: string, result: Record<string, unknown>) {
  if (path === "subscriptions/check" || path === "subscriptions/subscribe") {
    const fields = Array.isArray(result.subscribedFields) ? result.subscribedFields.filter((field): field is string => typeof field === "string").join(", ") : "none";
    return `subscription=${safeDiagnosticText(result.state || "UNKNOWN")}; fields=${safeDiagnosticText(fields || "none")}`;
  }
  if (path === "messages/test") {
    return `accepted=${safeDiagnosticText(result.accepted)}; recipient=${safeDiagnosticText(result.recipientMasked || "unknown")}; template=${safeDiagnosticText(result.templateName || "unknown")}; messageId=${safeDiagnosticText(result.providerMessageId || "unknown")}`;
  }
  if (path === "test-connection") {
    const capabilities = Array.isArray(result.capabilities)
      ? result.capabilities.map((capability) => {
        if (!capability || typeof capability !== "object") return "UNKNOWN";
        const item = capability as Record<string, unknown>;
        return `${safeDiagnosticText(item.key)}:${safeDiagnosticText(item.state)}`;
      }).join(", ")
      : "none";
    return `provider=${safeDiagnosticText(result.state || "UNKNOWN")}; capabilities=${safeDiagnosticText(capabilities)}`;
  }
  return "Server response received.";
}

function auditMetadataRecord(event: Record<string, unknown>) {
  const raw = event.safe_metadata_json;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

function safeAuditMetadata(event: Record<string, unknown>) {
  const safe = Object.entries(auditMetadataRecord(event))
    .filter(([key]) => !/(secret|token|password|authorization|cipher|fingerprint)/i.test(key))
    .map(([key, value]) => {
      const formatted = Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);
      return `${key}=${safeDiagnosticText(formatted)}`;
    });
  return safe.length ? safe.join(" · ") : "No safe metadata";
}

function latestTemplateSync(audit: Array<Record<string, unknown>>) {
  const event = audit.find((item) => String(item.event_type || "") === "template.sync");
  if (!event) return { completedAt: null, count: null, wabaId: null };
  const metadata = auditMetadataRecord(event);
  const count = Number(metadata.count);
  return {
    completedAt: String(event.created_at || "") || null,
    count: Number.isFinite(count) ? count : null,
    wabaId: String(metadata.wabaId || metadata.waba_id || "") || null,
  };
}

const EMPTY: Snapshot = {
  state: "NOT_CONFIGURED", version: 0, configuration: {}, credentials: {}, products: {}, capabilities: [
    { key: "meta.whatsapp.messaging", state: "UNAVAILABLE", reason: "TOKEN_WABA_OR_REGISTERED_PHONE_REQUIRED" },
    { key: "meta.whatsapp.inbound", state: "UNAVAILABLE", reason: "APP_SECRET_SIGNED_WEBHOOK_REQUIRED" },
    { key: "meta.whatsapp.authentication", state: "DISABLED", reason: "MESSAGING_TEMPLATE_AND_POLICY_REQUIRED" },
  ],
  webhook: { callbackUrl: null, getVerification: "PENDING", postSignatureVerification: "PENDING APP SECRET", postOperationalProcessing: "DISABLED / FAIL-CLOSED UNTIL APP SECRET AVAILABLE", subscription: "PENDING" },
  templates: [], audit: [],
  wabas: [], senders: [], mappings: [], authPolicies: [], health: [],
};

const productDefinitions = [
  ["whatsapp_business", "WhatsApp Business Platform", "Messaging, WABAs, phone numbers and templates", MessageSquare],
  ["whatsapp_authentication", "WhatsApp Authentication", "Optional verification for selected local-account workflows", ShieldCheck],
  ["whatsapp_webhooks", "WhatsApp Webhooks", "GET verification and signed POST processing", Webhook],
  ["facebook_login", "Facebook Login for Business", "Independent optional Meta sign-in product", Globe2],
  ["facebook_pages", "Facebook Pages", "Authorized Farms Page features", BookOpen],
  ["instagram", "Instagram", "Authorized Farms Instagram business features", Smartphone],
  ["embedded_signup", "Embedded Signup", "Optional onboarding configuration", Link2],
] as const;

const RECOMMENDED_UTILITY_TEMPLATE = {
  name: "daenem_farms_test_notice",
  category: "UTILITY",
  language: "en_US",
  components: JSON.stringify([{ type: "BODY", text: "Hello {{1}}, this is a Daenem Farms WhatsApp connection test." }], null, 2),
  localPurpose: "Controlled WhatsApp integration test",
};

function templateBodyFromComponents(value: string) {
  try {
    const components = JSON.parse(value);
    if (!Array.isArray(components)) return "";
    const body = components.find((component) => component && typeof component === "object" && String(component.type || "").toUpperCase() === "BODY");
    return typeof body?.text === "string" ? body.text : "";
  } catch {
    return "";
  }
}

function componentsWithBody(value: string) {
  return JSON.stringify([{ type: "BODY", text: value }], null, 2);
}

function statusTone(state: string) {
  if (["CONNECTED", "AVAILABLE", "VALID", "CONFIGURED", "SUBSCRIBED"].includes(state)) return styles.statusGood;
  if (["INVALID", "EXPIRED", "UNAVAILABLE"].includes(state)) return styles.statusBad;
  return styles.statusWarn;
}

function farmsWebhookCallbackUrl() {
  if (typeof window === "undefined") return "/webhooks/meta/whatsapp";
  return window.location.origin + "/webhooks/meta/whatsapp";
}

function HelpButton({ field, onOpen }: { field: string; onOpen: (help: MetaHelpRecord) => void }) {
  const help = META_HELP_REGISTRY.find((entry) => entry.credentialType === field);
  if (!help) return null;
  return <button type="button" className={styles.helpButton} onClick={() => onOpen(help)}><CircleHelp size={14} />{META_FIELD_DEFINITIONS.find((item) => item.key === field)?.secret ? "How To Get This Credential" : "How To Find This Value"}</button>;
}

function OperationHelpButton({ operation, onOpen }: { operation: string; onOpen: (help: MetaHelpRecord) => void }) {
  const help = META_OPERATION_HELP_REGISTRY.find((entry) => entry.credentialType === operation);
  if (!help) return null;
  return <button type="button" className={styles.helpButton} onClick={() => onOpen(help)}><CircleHelp size={14} />How this operation works</button>;
}

export default function MetaProviderControlPlane() {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [help, setHelp] = useState<MetaHelpRecord | null>(null);
  const [secretType, setSecretType] = useState<string | null>(null);
  const [secretValue, setSecretValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [templateDraft, setTemplateDraft] = useState(RECOMMENDED_UTILITY_TEMPLATE);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [diagnosticLog, setDiagnosticLog] = useState<DiagnosticLogEntry[]>([]);
  const [ownerApproval, setOwnerApproval] = useState<OwnerApprovalIntent | null>(null);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerApproving, setOwnerApproving] = useState(false);
  const ownerApprovalPending = useRef(false);

  function cancelOwnerApproval() {
    if (ownerApproving) return;
    ownerApprovalPending.current = false;
    ownerApproval?.resolve(null);
    setOwnerApproval(null);
    setOwnerPassword("");
  }

  async function confirmOwnerApproval() {
    if (!ownerApproval || !ownerPassword || ownerApproving) return;
    setOwnerApproving(true);
    try {
      const response = await fetch("/api/admin/integrations/meta/approvals", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: ownerApproval.method, path: ownerApproval.path, payload: ownerApproval.payload,
          password: ownerPassword, confirmation: "AUTHORIZE",
        }),
      });
      const data = await response.json().catch(() => ({})) as { approvalToken?: string; error?: string };
      if (!response.ok || !data.approvalToken) throw new Error(data.error || "OWNER_APPROVAL_REJECTED");
      ownerApprovalPending.current = false;
      ownerApproval.resolve(data.approvalToken);
      setOwnerApproval(null);
      setOwnerPassword("");
    } catch (error) {
      setOwnerPassword("");
      toast.error(error instanceof Error ? error.message : "Owner confirmation was not accepted.");
    } finally { setOwnerApproving(false); }
  }

  async function authorizedMetaFetch(
    path: string, method: "GET" | "POST" | "PUT" | "DELETE",
    payload?: Record<string, unknown>, action = path,
  ) {
    const headers: Record<string, string> = {};
    const body = method === "GET" || method === "DELETE" ? undefined : JSON.stringify(payload || {});
    if (body !== undefined) headers["content-type"] = "application/json";
    if (method !== "GET" && !(method === "POST" && path === "messages/test")) {
      if (ownerApprovalPending.current) throw new Error("OWNER_APPROVAL_ALREADY_PENDING");
      ownerApprovalPending.current = true;
      const token = await new Promise<string | null>((resolve) => {
        setOwnerPassword("");
        setOwnerApproval({ method, path, payload: method === "DELETE" ? null : payload || {}, action, resolve });
      });
      if (!token) throw new Error("OWNER_APPROVAL_CANCELLED");
      headers["x-daenem-meta-owner-approval"] = token;
    }
    return fetch(`/api/admin/integrations/meta/${path}`, {
      method, credentials: "include", cache: "no-store", headers,
      body,
    });
  }

  function appendDiagnostic(entry: Omit<DiagnosticLogEntry, "id">) {
    setDiagnosticLog((current) => [{ ...entry, id: `${Date.now()}-${current.length}` }, ...current].slice(0, 30));
  }

  async function load(source = "Re-check") {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    let logged = false;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/integrations/meta", { credentials: "include", cache: "no-store" });
      const result = await response.json().catch(() => ({})) as Snapshot & { code?: string; error?: string; message?: string };
      if (!response.ok) {
        const code = safeDiagnosticText(result.code || result.error || `HTTP_${response.status}`);
        appendDiagnostic({
          action: source,
          method: "GET",
          path: "/api/admin/integrations/meta",
          startedAt,
          status: "failure",
          httpStatus: response.status,
          durationMs: Math.round(performance.now() - started),
          code,
          detail: safeDiagnosticText(result.message || result.error || "Control-plane snapshot request failed."),
        });
        logged = true;
        throw new Error(code);
      }
      const next = result as Snapshot;
      setSnapshot(next);
      setDraft(next.configuration);
      setServerAvailable(true);
      appendDiagnostic({
        action: source,
        method: "GET",
        path: "/api/admin/integrations/meta",
        startedAt,
        status: "success",
        httpStatus: response.status,
        durationMs: Math.round(performance.now() - started),
        detail: `state=${safeDiagnosticText(next.state)}; GET verification=${safeDiagnosticText(next.webhook.getVerification)}; subscription=${safeDiagnosticText(next.webhook.subscription)}; App Secret=${safeDiagnosticText(next.credentials.meta_app_secret?.validationState || "NOT_CONFIGURED")}; capabilities=${safeDiagnosticText(next.capabilities.map((item) => `${item.key}:${item.state}`).join(", "))}`,
      });
      return next;
    } catch (error) {
      setServerAvailable(false);
      setSnapshot(EMPTY);
      setDraft({});
      if (!logged) {
        appendDiagnostic({
          action: source,
          method: "GET",
          path: "/api/admin/integrations/meta",
          startedAt,
          status: "failure",
          durationMs: Math.round(performance.now() - started),
          code: safeDiagnosticText(error instanceof Error ? error.message : "CONTROL_PLANE_UNAVAILABLE"),
          detail: "The control-plane snapshot could not be loaded; the UI reset to fail-closed state.",
        });
      }
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load("Initial load"); }, []);

  const capabilityMap = useMemo(() => Object.fromEntries(snapshot.capabilities.map((capability) => [capability.key, capability])), [snapshot.capabilities]);
  const templateSync = useMemo(() => latestTemplateSync(snapshot.audit), [snapshot.audit]);

  async function saveConfiguration(nextDraft = draft) {
    setSaving(true);
    try {
      const response = await authorizedMetaFetch("configuration", "PUT", nextDraft, "Save Meta Configuration");
      const body = await response.json() as Snapshot & { code?: string; error?: string };
      if (!response.ok) throw new Error(body.code || body.error || "SAVE_FAILED");
      setSnapshot(body); setDraft(body.configuration || nextDraft); toast.success("Meta configuration saved. Capability state updated immediately.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Configuration could not be saved."); }
    finally { setSaving(false); }
  }

  async function replaceSecret() {
    if (!secretType || !secretValue) return;
    setSaving(true);
    try {
      const response = await authorizedMetaFetch(`credentials/${secretType}`, "POST", { value: secretValue }, "Replace Protected Meta Credential");
      const body = await response.json() as { promoted?: boolean; code?: string; error?: string };
      if (!response.ok) throw new Error(body.code || body.error || "VALIDATION_FAILED");
      toast.success(secretType === "meta_app_secret" ? "App Secret stored; signed-webhook validation remains pending." : "Credential validated and activated.");
      setSecretType(null); setSecretValue(""); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Credential replacement failed; the current valid credential remains active."); }
    finally { setSaving(false); }
  }

  async function setProduct(key: string, value: boolean) {
    try {
      const response = await authorizedMetaFetch("products", "PUT", { [key]: value }, `Change ${key.replaceAll("_", " ")} Product`);
      const body = await response.json() as Snapshot & { code?: string; error?: string }; if (!response.ok) throw new Error(body.code || body.error); setSnapshot(body);
      toast.success(`${key.replaceAll("_", " ")} ${value ? "enabled" : "disabled"}.`);
    } catch { toast.error("Product state could not be changed."); }
  }

  async function callOperation(path: string, method: "GET" | "POST" | "PUT" = "POST", body?: Record<string, unknown>, action = path) {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    let logged = false;
    try {
      const response = await authorizedMetaFetch(path, method, body || {}, action);
      const result = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        const code = safeDiagnosticText(result.code || result.error || `HTTP_${response.status}`);
        appendDiagnostic({
          action,
          method,
          path: `/api/admin/integrations/meta/${path}`,
          startedAt,
          status: "failure",
          httpStatus: response.status,
          durationMs: Math.round(performance.now() - started),
          code,
          detail: safeDiagnosticText(result.message || result.error || "Provider operation failed."),
        });
        logged = true;
        throw new Error(code);
      }
      appendDiagnostic({
        action,
        method,
        path: `/api/admin/integrations/meta/${path}`,
        startedAt,
        status: "success",
        httpStatus: response.status,
        durationMs: Math.round(performance.now() - started),
        detail: diagnosticResultDetail(path, result),
      });
      return result;
    } catch (error) {
      if (!logged) {
        appendDiagnostic({
          action,
          method,
          path: `/api/admin/integrations/meta/${path}`,
          startedAt,
          status: "failure",
          durationMs: Math.round(performance.now() - started),
          code: safeDiagnosticText(error instanceof Error ? error.message : "PROVIDER_OPERATION_FAILED"),
          detail: "The operation did not return a usable response.",
        });
      }
      throw error;
    }
  }

  async function discoverWabas() {
    try { const result = await callOperation("wabas/discover"); setSnapshot((current) => ({ ...current, wabas: Array.isArray(result.items) ? result.items as Array<Record<string, unknown>> : current.wabas })); toast.success("Farms WABAs discovered. Select one explicitly."); } catch (error) { toast.error(error instanceof Error ? error.message : "WABA discovery failed."); }
  }

  async function selectWaba(wabaId: string) {
    if (!wabaId) return;
    try { const result = await callOperation("wabas/select", "PUT", { wabaId }); setSnapshot(result as Snapshot); toast.success("Farms WABA selected."); } catch (error) { toast.error(error instanceof Error ? error.message : "WABA selection failed."); }
  }

  async function discoverPhones() {
    try { const result = await callOperation("phones/discover"); setSnapshot((current) => ({ ...current, senders: Array.isArray(result.items) ? result.items as Array<Record<string, unknown>> : current.senders })); toast.success("Farms phone numbers discovered. Select one explicitly."); } catch (error) { toast.error(error instanceof Error ? error.message : "Phone discovery failed."); }
  }

  async function selectPhone(phoneId: string) {
    if (!phoneId) return;
    try { const result = await callOperation("phones/select", "PUT", { phoneId }); setSnapshot(result as Snapshot); toast.success("Farms phone selected."); } catch (error) { toast.error(error instanceof Error ? error.message : "Phone selection failed."); }
  }

  async function syncTemplates() {
    try {
      const result = await callOperation("templates/sync", "POST", undefined, "Sync Templates From Meta");
      const templates = Array.isArray(result.templates) ? result.templates as Array<Record<string, unknown>> : [];
      setSnapshot((current) => ({ ...current, templates }));
      await load("Template Sync · refresh");
      toast.success(`Meta template sync completed: ${templates.length} template${templates.length === 1 ? "" : "s"} returned.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Template synchronization failed. Open the operation debug log.");
    }
  }

  async function createTemplate() {
    try {
      const components = JSON.parse(templateDraft.components);
      const result = await callOperation(editingTemplateId ? `templates/${editingTemplateId}` : "templates", editingTemplateId ? "PUT" : "POST", { ...templateDraft, components });
      setSnapshot((current) => ({ ...current, templates: Array.isArray(result.templates) ? result.templates as Array<Record<string, unknown>> : current.templates }));
      setTemplateDraft(RECOMMENDED_UTILITY_TEMPLATE);
      setEditingTemplateId(null);
      toast.success(editingTemplateId ? "Template update submitted to Meta." : "Template submitted to Meta for review.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Template creation failed."); }
  }

  function editTemplate(template: Record<string, unknown>) {
    const id = String(template.id || "");
    if (!id) return;
    setEditingTemplateId(id);
    setTemplateDraft({ name: String(template.name || ""), category: String(template.category || "UTILITY"), language: String(template.language || "en_US"), components: JSON.stringify(template.components || []), localPurpose: String(template.local_purpose || template.localPurpose || "") });
  }

  async function mapTemplate(workflowKey: string, templateId: string, enabled: boolean) {
    if (!templateId) return;
    try { const result = await callOperation("template-mappings", "POST", { workflowKey, templateId, enabled }); setSnapshot((current) => ({ ...current, mappings: Array.isArray(result.mappings) ? result.mappings as Array<Record<string, unknown>> : current.mappings, authPolicies: Array.isArray(result.authPolicies) ? result.authPolicies as Array<Record<string, unknown>> : current.authPolicies })); toast.success("Template mapping saved."); } catch (error) { toast.error(error instanceof Error ? error.message : "Template mapping failed."); }
  }

  async function savePolicy(policyKey: string, enabled: boolean) {
    const current = snapshot.authPolicies.find((policy) => policy.policy_key === policyKey) || {};
    try { const result = await callOperation("auth-policies", "POST", { policyKey, enabled, templateMappingId: current.template_mapping_id || null, expiresSeconds: Number(current.expires_seconds || 300), cooldownSeconds: Number(current.cooldown_seconds || 30), maxAttempts: Number(current.max_attempts || 5), resendMaximum: Number(current.resend_maximum || 3), rateLimitPolicy: current.rateLimitPolicy || {}, eligibleRoles: current.eligibleRoles || [], eligibleFarms: current.eligibleFarms || [], fallbackBehavior: current.fallback_behavior || "DISABLED" }); setSnapshot((currentSnapshot) => ({ ...currentSnapshot, authPolicies: Array.isArray(result.authPolicies) ? result.authPolicies as Array<Record<string, unknown>> : currentSnapshot.authPolicies })); toast.success(`${policyKey.replaceAll("_", " ")} policy saved.`); } catch (error) { toast.error(error instanceof Error ? error.message : "Authentication policy could not be saved."); }
  }

  async function refreshWebhookVerification() {
    const next = await load("Refresh GET Status");
    if (next) toast.message(`Status refreshed: GET verification is ${next.webhook.getVerification}. Meta must complete Verify and save to mark it VERIFIED.`);
    else toast.error("Status refresh failed. Open the Live operation debug log for the HTTP result.");
  }

  async function checkSubscription() {
    try {
      const result = await callOperation("subscriptions/check", "POST", undefined, "Check Subscription");
      setSnapshot((current) => ({ ...current, webhook: { ...current.webhook, subscription: String(result.state || "PENDING") } }));
      await load("Check Subscription · refresh");
      toast.success(`WABA subscription state checked: ${String(result.state || "PENDING")}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Subscription inspection failed. Open the Live operation debug log.");
    }
  }

  async function subscribeWaba() {
    try {
      const result = await callOperation("subscriptions/subscribe", "POST", undefined, "Subscribe App To WABA");
      setSnapshot((current) => ({ ...current, webhook: { ...current.webhook, subscription: String(result.state || "PENDING") } }));
      await load("Subscribe App To WABA · refresh");
      toast.success(`Farms App subscription request completed: ${String(result.state || "PENDING")}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Subscription mutation failed. Open the Live operation debug log.");
    }
  }

  async function testConnection() {
    try {
      await callOperation("test-connection", "POST", {}, "Test Connection");
      await load("Test Connection · refresh");
      toast.success("Server-side capability evaluation completed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection test failed. Open the Live operation debug log.");
    }
  }

  function generateVerifyToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const value = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    setSecretType("webhook_verify_token"); setSecretValue(value);
    toast.message("A new one-time verify token is ready. Copy it before saving; it cannot be revealed later.");
  }

  function copyFarmsWebhookCallback() {
    void navigator.clipboard.writeText(farmsWebhookCallbackUrl());
    toast.success("Farms callback URL copied.");
  }

  async function setFarmsWebhookCallback() {
    await saveConfiguration({ ...draft, webhook_callback_url: farmsWebhookCallbackUrl() });
  }

  // A failed Owner API read must never masquerade as deleted Meta settings.
  // Hide all configuration editors until an authorized snapshot loads.
  if (loading || !serverAvailable) {
    const lastFailure = diagnosticLog.find((entry) => entry.status === "failure");
    return <div className={styles.page} data-testid="meta-provider-control-plane">
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>Admin · Integrations · Meta & WhatsApp</span><h1>Meta Provider Control Plane</h1></div>
      </header>
      <div className={styles.notice} role={loading ? "status" : "alert"} data-testid="meta-snapshot-unavailable">
        <TriangleAlert size={18} />
        <div>
          <strong>{loading ? "Loading Saved Meta Settings" : "Saved Meta Settings Could Not Be Loaded"}</strong>
          <p>{loading
            ? "Checking the authorized configuration. Nothing is being changed."
            : "The server did not return your authorized settings. This does not mean they were deleted. Do not re-enter credentials or recreate templates. Sign in with an authorized Owner account, then Re-check."}</p>
          {!loading && lastFailure && <p>Request status: {lastFailure.httpStatus ?? "Unavailable"} · {safeDiagnosticText(lastFailure.code || "LOAD_FAILED")}</p>}
        </div>
        <Button variant="outline" onClick={() => void load("Manual recovery check")} disabled={loading}>
          <RefreshCw size={15} />Re-check
        </Button>
      </div>
    </div>;
  }

  return <div className={styles.page} data-testid="meta-provider-control-plane">
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>Admin · Integrations · Meta & WhatsApp</span><h1>Meta provider control plane</h1><p>Configure Farms-owned Meta products without changing source code. Local sign-in and every non-Meta workspace remain independent.</p></div>
      <div className={styles.heroActions}><span className={`${styles.statePill} ${statusTone(snapshot.state)}`}>{snapshot.state.replaceAll("_", " ")}</span><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? styles.spin : ""} />Re-check</Button></div>
    </header>

    {!serverAvailable && <div className={styles.notice} role="status"><TriangleAlert size={18} /><div><strong>Meta control plane is unavailable in this review session.</strong><p>The Farms website remains usable. No Meta capability is treated as configured, and no secret has been exposed.</p></div></div>}

    <div className={styles.notice} role="status" data-testid="meta-owner-configuration-locked">
      <LockKeyhole size={18} />
      <div><strong>Meta & WhatsApp Configuration Protected</strong>
      <p>Credentials, WABA selection, templates, policies, and webhooks are protected by mandatory fresh Owner password confirmation for each exact change. A signed approval expires after two minutes and cannot be reused. Viewing settings and consent-confirmed test messages remain available.</p></div>
    </div>

    <div className={styles.postureGrid}>
      <Posture label="Local DAENEM Farms" value="Available independently" icon={ShieldCheck} state="good" />
      <Posture label="Meta configuration" value={snapshot.state.replaceAll("_", " ")} icon={Settings2} state={snapshot.state === "CONNECTED" ? "good" : "warn"} />
      <Posture label="WhatsApp messaging" value={capabilityMap["meta.whatsapp.messaging"]?.state || "UNAVAILABLE"} icon={MessageSquare} state={capabilityMap["meta.whatsapp.messaging"]?.state === "AVAILABLE" ? "good" : "warn"} />
      <Posture label="Webhook POST security" value={snapshot.webhook.postOperationalProcessing} icon={LockKeyhole} state={snapshot.webhook.postSignatureVerification === "CONFIGURED" ? "good" : "bad"} />
    </div>

    <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.console}>
      <TabsList className={styles.tabs}>
        {["overview", "credentials", "products", "whatsapp", "activity", "authentication", "webhooks", "templates", "diagnostics", "audit"].map((tab) => <TabsTrigger key={tab} value={tab}>{tab[0].toUpperCase() + tab.slice(1)}</TabsTrigger>)}
      </TabsList>

      <TabsContent value="overview"><Overview snapshot={snapshot} openHelp={setHelp} /></TabsContent>
      <TabsContent value="credentials">
        <section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Authoritative configuration</span><h2>Identifiers and configuration</h2><p>These values are administrative data. Saving them increments the configuration version and invalidates provider caches.</p></div><Button onClick={() => void saveConfiguration()} disabled={saving || !serverAvailable}><Save size={15} />Save configuration</Button></div>
          <div className={styles.fieldGrid}>{META_FIELD_DEFINITIONS.filter((field) => !field.secret).map((field) => <div className={styles.fieldCard} key={field.key}><div className={styles.fieldTitle}><Label htmlFor={field.key}>{field.label}</Label><Badge variant="outline">{field.kind}</Badge></div><p>{field.description}</p><Input id={field.key} value={draft[field.key] || ""} placeholder={field.placeholder} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} autoComplete="off" /><div className={styles.fieldMeta}><span>{field.origin}</span><span>{field.requirement}</span></div><HelpButton field={field.key} onOpen={setHelp} /></div>)}</div>
        </section>
        <section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Encrypted credentials</span><h2>Secrets are write-only</h2><p>Saved plaintext is never returned, pre-populated, or revealed. Replacement validation preserves the last known-working version when validation fails.</p></div><EyeOff size={20} /></div>
          <div className={styles.secretGrid}>{META_FIELD_DEFINITIONS.filter((field) => field.secret).map((field) => { const state = snapshot.credentials[field.key]; return <article className={styles.secretCard} key={field.key}><div className={styles.secretIcon}><FileKey2 size={19} /></div><div className={styles.secretBody}><div><strong>{field.label}</strong><span className={`${styles.miniState} ${statusTone(state?.validationState || "NOT_CONFIGURED")}`}>{state?.validationState || (field.key === "meta_app_secret" ? "APP SECRET PENDING" : "NOT CONFIGURED")}</span></div><p>{field.description}</p>{state?.configured && <small>Fingerprint {state.fingerprint} · Updated <LoggedTimestamp value={state.updatedAt}/></small>}<HelpButton field={field.key} onOpen={setHelp} /></div><Button variant="outline" onClick={() => { setSecretType(field.key); setSecretValue(""); }}>{state?.configured ? "Replace" : "Configure"}</Button></article>; })}</div>
        </section>
      </TabsContent>

      <TabsContent value="products"><section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>One provider · independent products</span><h2>Enable only what Farms uses</h2><p>Each product declares its own required identifiers, scopes, approvals and health checks.</p></div><Badge variant="outline">Capability model</Badge></div><div className={styles.productGrid}>{productDefinitions.map(([key, name, detail, Icon]) => <article className={styles.productCard} key={key}><span><Icon size={19} /></span><div><strong>{name}</strong><p>{detail}</p><small>{snapshot.products[key] ? "Enabled · prerequisites evaluated" : "Disabled"}</small></div><Switch checked={snapshot.products[key] === true} onCheckedChange={(value) => void setProduct(key, value)} disabled={!serverAvailable} aria-label={`Enable ${name}`} /></article>)}</div></section></TabsContent>

      <TabsContent value="whatsapp">
        <MetaWhatsAppTestMessage
          templates={snapshot.templates}
          messagingAvailable={snapshot.capabilities.some((item) => item.key === "meta.whatsapp.messaging" && item.state === "AVAILABLE")}
          selectedWabaId={snapshot.configuration.waba_id || ""}
          templateSync={templateSync}
          onOpenTemplates={() => setActiveTab("templates")}
          onSend={(payload) => callOperation("messages/test", "POST", payload, "WhatsApp Test Send")}
        />
        <section className={styles.surface}>
          <div className={styles.surfaceHeading}>
            <div><span className={styles.eyebrow}>WhatsApp Business</span><h2>Dedicated Farms assets only</h2><p>Discovery is server-side and selection is always explicit. Staff Portal assets are rejected before persistence.</p></div>
            <div><Badge variant="outline">No auto-selection</Badge><OperationHelpButton operation="operation_discover_wabas" onOpen={setHelp} /></div>
          </div>
          <div className={styles.assetGrid}>
            <Asset title="Business Portfolio" value={snapshot.configuration.business_portfolio_id || "Not configured"} icon={Database} />
            <Asset title="WhatsApp Business Account" value={snapshot.configuration.waba_id || "Not configured"} icon={MessageSquare} />
            <Asset title="Phone number ID" value={snapshot.configuration.phone_number_id || "Not configured"} icon={Phone} />
            <Asset title="Registration" value={snapshot.configuration.phone_registration_state || "UNKNOWN"} icon={Smartphone} />
          </div>
          <div className={styles.actionRow}>
            <Button variant="outline" onClick={() => void discoverWabas()} disabled={!serverAvailable}>Discover WABAs</Button>
            <Button variant="outline" onClick={() => void discoverPhones()} disabled={!serverAvailable || !snapshot.configuration.waba_id}>Discover Phone Numbers</Button>
            <OperationHelpButton operation="operation_discover_phone_numbers" onOpen={setHelp} />
            <span>Meta responses are sanitized before reaching the browser.</span>
          </div>
          {snapshot.wabas.length > 0 && <div className={styles.selectionRow}><Label htmlFor="farms-waba-selection">Select Farms WABA</Label><select id="farms-waba-selection" value={explicitlySelectedAssetId(snapshot.wabas)} onChange={(event) => void selectWaba(event.target.value)}><option value="">Choose a discovered WABA</option>{snapshot.wabas.map((waba) => <option key={String(waba.id || waba.provider_waba_id)} value={String(waba.id || waba.provider_waba_id)}>{String(waba.name || waba.display_name || "Unnamed WABA")} · {String(waba.id || waba.provider_waba_id)}</option>)}</select></div>}
          {snapshot.senders.length > 0 && <div className={styles.selectionRow}><Label htmlFor="farms-phone-selection">Select Farms phone number</Label><select id="farms-phone-selection" value={explicitlySelectedAssetId(snapshot.senders)} onChange={(event) => void selectPhone(event.target.value)}><option value="">Choose a discovered phone</option>{snapshot.senders.map((sender) => <option key={String(sender.id || sender.provider_phone_number_id)} value={String(sender.id || sender.provider_phone_number_id)}>{String(sender.displayPhoneNumber || sender.display_phone_masked || "Masked number")} · {String(sender.verifiedName || sender.verified_name || "Unverified name")}</option>)}</select></div>}
        </section>
      </TabsContent>

      <TabsContent value="activity"><CommunicationsActivityPanel /></TabsContent>

      <TabsContent value="authentication"><section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Optional step-up verification</span><h2>WhatsApp never replaces local identity</h2><p>Policies are persisted server-side with bounded expiry, cooldown, attempts, resend and scope controls. Verification is not authorization.</p></div><Badge variant="outline">{snapshot.authPolicies.some((policy) => policy.enabled === 1 || policy.enabled === true) ? "CONFIGURED" : "DISABLED"}</Badge></div><div className={styles.policyGrid}>{[{ key: "signup_verification", label: "Signup Verification" }, { key: "signin_verification", label: "Signin Verification" }, { key: "account_recovery", label: "Account Recovery" }, { key: "privileged_action_verification", label: "Privileged Action Verification" }, { key: "phone_enrollment", label: "Phone Enrollment" }, { key: "phone_change_verification", label: "Phone-change Verification" }].map((policy) => { const stored = snapshot.authPolicies.find((item) => item.policy_key === policy.key); return <div key={policy.key}><span><strong>{policy.label}</strong><small>Requires messaging + approved Authentication template</small></span><Switch checked={stored?.enabled === 1 || stored?.enabled === true} onCheckedChange={(enabled) => void savePolicy(policy.key, enabled)} disabled={!serverAvailable} aria-label={`Enable ${policy.label}`} /></div>; })}</div><div className={styles.securityStrip}><ShieldCheck size={18} /><span>CSPRNG · keyed HMAC storage · one-time use · short expiry · attempt limits · cooldown · anti-enumeration · no raw OTP persistence</span></div></section></TabsContent>

      <TabsContent value="webhooks"><section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Farms callback contract</span><h2>Signed inbound processing fails closed</h2><p>GET challenge verification is independent. POST processing cannot trust or store operational payloads without a validated App Secret.</p></div><Webhook size={20} /></div><div className={styles.webhookBox}><code>GET /webhooks/meta/whatsapp</code><code>POST /webhooks/meta/whatsapp</code><div><span>Canonical Farms endpoint</span><strong>{farmsWebhookCallbackUrl()}</strong></div><div><span>Saved callback URL</span><strong>{snapshot.webhook.callbackUrl || "NOT SAVED"}</strong></div><div><span>GET verification</span><strong>{snapshot.webhook.getVerification}</strong></div><div><span>POST signature verification</span><strong>{snapshot.webhook.postSignatureVerification}</strong></div><div><span>Operational processing</span><strong>{snapshot.webhook.postOperationalProcessing}</strong></div><div><span>App → WABA subscription</span><strong>{snapshot.webhook.subscription}</strong></div></div><div className={styles.actionRow}><Button variant="outline" onClick={copyFarmsWebhookCallback}><Copy size={15} />Copy Callback URL</Button><Button variant="outline" onClick={() => void setFarmsWebhookCallback()} disabled={!serverAvailable || saving || snapshot.webhook.callbackUrl === farmsWebhookCallbackUrl()}><Link2 size={15} />Save Farms Callback</Button><Button variant="outline" onClick={generateVerifyToken}><KeyRound size={15} />Generate Secure Token</Button><Button variant="outline" onClick={() => void refreshWebhookVerification()} disabled={!serverAvailable || loading || !snapshot.webhook.callbackUrl}><RefreshCw size={15} />Refresh GET Status</Button><Button variant="outline" onClick={() => void checkSubscription()} disabled={!serverAvailable || !snapshot.configuration.waba_id}>Check Subscription</Button><Button variant="outline" onClick={() => void subscribeWaba()} disabled={!serverAvailable || !snapshot.webhook.callbackUrl || !snapshot.configuration.waba_id}>Subscribe App To WABA</Button></div></section></TabsContent>

      <TabsContent value="templates">
        <section className={styles.surface}>
          <div className={styles.surfaceHeading}>
            <div><span className={styles.eyebrow}>WABA template registry</span><h2>Guided template setup</h2><p>Create the missing template here, then synchronize once Meta has reviewed it. Meta remains authoritative for approval.</p></div>
            <Button variant="outline" onClick={() => void syncTemplates()} disabled={!serverAvailable || !snapshot.configuration.waba_id}><RefreshCw size={15} />Refresh after Meta approval</Button>
          </div>

          <div className={styles.templateSyncSummary} role="status">
            <div><span>Selected WABA</span><strong>{snapshot.configuration.waba_id || "Not selected"}</strong></div>
            <div><span>Last completed sync</span><strong>{templateSync.completedAt ? <LoggedTimestamp value={templateSync.completedAt}/> : "Not synchronized yet"}</strong></div>
            <div><span>Last Meta result</span><strong>{templateSync.count === null ? "No result recorded" : `${templateSync.count} template${templateSync.count === 1 ? "" : "s"} returned`}</strong></div>
          </div>

          {snapshot.templates.length ? (
            <div className={styles.templateList}>{snapshot.templates.map((template, index) => <div key={String(template.id || index)}><strong>{String(template.name || "Unnamed")}</strong><span>{String(template.category || "—")}</span><span>{String(template.language || "—")}</span><span>{String(template.provider_status || "UNKNOWN")}</span><small>{String(template.rejection_reason || template.rejectionReason || "")}</small></div>)}</div>
          ) : (
            <div className={styles.templateZeroState}>
              <TriangleAlert size={20} />
              <div><strong>{templateSync.count === 0 ? "Meta returned 0 templates for this WABA." : "No template inventory is available yet."}</strong><p>This is the specific blocker for the test-send workflow. Use the guided Utility template below; submitting creates a Meta review request but does not send a WhatsApp message.</p></div>
            </div>
          )}

          <div className={styles.templateComposer}>
            <div className={styles.templateComposerHeading}><div><span>Step 1</span><h3>{editingTemplateId ? "Update the selected template" : "Create the controlled test template"}</h3><p>The recommended values are prefilled. Review them before submitting to Meta.</p></div><Badge variant="outline">UTILITY · SAFE DEFAULT</Badge></div>
            <div className={styles.inlineFields}>
              <div><Label htmlFor="template-name">Template name</Label><Input id="template-name" placeholder="daenem_farms_test_notice" value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} /></div>
              <div><Label htmlFor="template-category">Category</Label><select id="template-category" aria-label="Template category" value={templateDraft.category} onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value }))}><option value="UTILITY">UTILITY</option><option value="AUTHENTICATION">AUTHENTICATION</option></select></div>
              <div><Label htmlFor="template-language">Language</Label><Input id="template-language" aria-label="Template language" placeholder="en_US" value={templateDraft.language} onChange={(event) => setTemplateDraft((current) => ({ ...current, language: event.target.value }))} /></div>
            </div>
            <div><Label htmlFor="template-purpose">FarmPortal purpose</Label><Input id="template-purpose" aria-label="Local template purpose" placeholder="Controlled WhatsApp integration test" value={templateDraft.localPurpose} onChange={(event) => setTemplateDraft((current) => ({ ...current, localPurpose: event.target.value }))} /></div>
            <div><Label htmlFor="template-body">Message body</Label><Textarea id="template-body" aria-label="Template message body" value={templateBodyFromComponents(templateDraft.components)} onChange={(event) => setTemplateDraft((current) => ({ ...current, components: componentsWithBody(event.target.value) }))} /><small>Use <code>{"{{1}}"}</code> for the recipient name. FarmPortal asks for its value before a test can be reviewed.</small></div>
            <div className={styles.templatePreview}><span>Preview</span><p>{templateBodyFromComponents(templateDraft.components).replace("{{1}}", "Customer") || "Add a message body to preview it here."}</p></div>
            <details className={styles.advancedTemplate}>
              <summary>Advanced component JSON</summary>
              <Textarea aria-label="Template components JSON" value={templateDraft.components} onChange={(event) => setTemplateDraft((current) => ({ ...current, components: event.target.value }))} />
            </details>
            <div className={styles.templateSubmitRow}>
              <div><strong>No message is sent here.</strong><span>Submission creates or updates a Meta template review request for the selected WABA.</span></div>
              <Button onClick={() => void createTemplate()} disabled={!serverAvailable || !snapshot.configuration.waba_id || !templateDraft.name || !templateBodyFromComponents(templateDraft.components)}><Save size={15} />{editingTemplateId ? "Submit update to Meta" : "Submit template to Meta review"}</Button>
            </div>
          </div>

          <div className={styles.mappingGrid}><h3>Workflow mappings</h3>{["signup_verification", "signin_verification", "account_recovery", "account_status", "operational_notice", "support_followup"].map((workflow) => { const mapping = snapshot.mappings.find((item) => item.workflow_key === workflow); return <div key={workflow}><strong>{workflow.replaceAll("_", " ")}</strong><select aria-label={`Template for ${workflow}`} value={String(mapping?.template_id || "")} onChange={(event) => void mapTemplate(workflow, event.target.value, Boolean(event.target.value))}><option value="">Not mapped</option>{snapshot.templates.map((template) => <option key={String(template.id)} value={String(template.id)}>{String(template.name)} · {String(template.provider_status)}</option>)}</select></div>; })}</div>
        </section>
      </TabsContent>

      <TabsContent value="diagnostics"><section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Server-side validation</span><h2>Capability diagnostics</h2><p>No access token is sent to browser JavaScript for Graph API calls.</p></div><Button variant="outline" onClick={() => void testConnection()} disabled={!serverAvailable}><Activity size={15} />Test connection</Button></div><div className={styles.capabilityList}>{snapshot.capabilities.map((capability) => <div key={capability.key}><span className={statusTone(capability.state)}>{capability.state === "AVAILABLE" ? <CheckCircle2 size={16} /> : capability.state === "UNAVAILABLE" ? <XCircle size={16} /> : <TriangleAlert size={16} />}</span><span><strong>{capability.key}</strong><small>{capability.reason.replaceAll("_", " ")}</small></span><b>{capability.state}</b></div>)}</div></section></TabsContent>

      <TabsContent value="audit"><section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Redacted history</span><h2>Configuration audit</h2><p>Events include actor, action and outcome—never secret values, token prefixes, OTPs or plaintext.</p></div><Badge variant="outline">Last 50</Badge></div>{snapshot.audit.length ? <div className={styles.auditList}>{snapshot.audit.map((event, index) => <div key={index}><strong>{String(event.event_type || "Configuration event")}</strong><span>{String(event.outcome || "—")}</span><LoggedTimestamp value={event.created_at}/><small className={styles.auditMeta}>{safeAuditMetadata(event)}</small></div>)}</div> : <Empty title="No Meta configuration events" detail="The first authorized configuration change will appear here." />}</section></TabsContent>
    </Tabs>

    <section className={styles.diagnosticPanel} data-testid="meta-diagnostic-log" aria-label="Live operation debug log">
      <div className={styles.diagnosticHeading}>
        <div>
          <span className={styles.eyebrow}>Live troubleshooting</span>
          <h2>Operation debug log</h2>
          <p>Redacted client trace for Re-check, webhook status, subscription and server diagnostics. Secrets, tokens and payloads are never shown.</p>
        </div>
        <div className={styles.diagnosticActions}>
          <Badge variant="outline">{diagnosticLog.length} event{diagnosticLog.length === 1 ? "" : "s"}</Badge>
          <Button variant="outline" onClick={() => setDiagnosticLog([])} disabled={!diagnosticLog.length}>Clear log</Button>
        </div>
      </div>
      {!diagnosticLog.length ? <div className={styles.diagnosticEmpty}>Click Re-check or a provider action to see the request route, HTTP result, response code and resulting state here.</div> : <div className={styles.diagnosticList}>{diagnosticLog.map((entry) => <article className={styles.diagnosticEntry} key={entry.id}><div className={styles.diagnosticEntryTop}><strong>{entry.action}</strong><span className={entry.status === "success" ? styles.diagnosticOk : styles.diagnosticFail}>{entry.status.toUpperCase()}</span><time>{entry.startedAt}</time></div><code>{entry.method} {entry.path}{entry.httpStatus ? ` · HTTP ${entry.httpStatus}` : ""}{entry.durationMs === undefined ? "" : ` · ${entry.durationMs}ms`}</code><p>{entry.detail}</p>{entry.code && <small>Code: {entry.code}</small>}</article>)}</div>}
    </section>

    {activeTab === "templates" && <div className={styles.operationGuideStrip}><strong>Official template operation guidance</strong><OperationHelpButton operation="operation_template_sync" onOpen={setHelp} /><OperationHelpButton operation="operation_template_submission" onOpen={setHelp} /><OperationHelpButton operation="operation_authentication_templates" onOpen={setHelp} /></div>}
    {activeTab === "webhooks" && <div className={styles.operationGuideStrip}><strong>Official subscription guidance</strong><OperationHelpButton operation="operation_subscription_inspection" onOpen={setHelp} /><OperationHelpButton operation="operation_subscription_mutation" onOpen={setHelp} /></div>}
    {activeTab === "whatsapp" && snapshot.wabas.length > 0 && <section className={styles.discoveryDetailStrip} aria-label="Discovered Farms WABA metadata"><strong>Discovered WABA metadata</strong>{snapshot.wabas.map((waba, index) => <div key={String(waba.id || waba.provider_waba_id || index)}><span>{String(waba.name || waba.display_name || "Unnamed WABA")} · ID {String(waba.id || waba.provider_waba_id || "UNKNOWN")}</span><small>Owner {String(waba.ownerBusinessId || waba.owner_business_id || "UNKNOWN")} · Status {String(waba.status || "UNKNOWN")} · Access {String(waba.accessState || "ACCESSIBLE")}</small></div>)}</section>}
    {activeTab === "whatsapp" && snapshot.senders.length > 0 && <section className={styles.discoveryDetailStrip} aria-label="Discovered Farms phone metadata"><strong>Discovered phone metadata</strong>{snapshot.senders.map((sender, index) => <div key={String(sender.id || sender.provider_phone_number_id || index)}><span>{String(sender.displayPhoneNumber || sender.display_phone_masked || "Masked number")}</span><small>{String(sender.verifiedName || sender.verified_name || "Unverified name")} · ID {String(sender.id || sender.provider_phone_number_id || "UNKNOWN")} · Quality {String(sender.qualityState || sender.quality_state || "UNKNOWN")} · Registration {String(sender.registrationState || sender.registration_state || "UNKNOWN")}</small></div>)}</section>}

    {snapshot.templates.length > 0 && <section className={styles.templateEditShortcuts} aria-label="Edit synchronized Farms templates"><div><strong>Update a synchronized template</strong><p>Edits remain server-side and Meta remains authoritative for the resulting status.</p></div><div className={styles.templateEditButtons}>{snapshot.templates.map((template, index) => <Button key={String(template.id || index)} variant="outline" onClick={() => { editTemplate(template); setActiveTab("templates"); }}>{String(template.name || "Unnamed template")}</Button>)}</div></section>}

    <Sheet open={Boolean(help)} onOpenChange={(open) => !open && setHelp(null)}><SheetContent className={styles.helpSheet}><SheetHeader><SheetTitle>{help?.title}</SheetTitle><SheetDescription>{help?.what}</SheetDescription></SheetHeader>{help && <div className={styles.helpContent}><HelpSection title="Why Farms needs it"><p>{help.why}</p></HelpSection><div className={styles.helpFacts}><span>Secret<strong>{help.secret ? "YES" : "NO"}</strong></span><span>Required when<strong>{help.requiredWhen}</strong></span><span>Guidance status<strong>{help.verificationStatus.replaceAll("_", " ")}</strong></span><span>Last verified<strong>{help.lastVerifiedAt}</strong></span></div><HelpSection title="Current official workflow"><ol>{help.steps.map((step) => <li key={step}>{step}</li>)}</ol></HelpSection><HelpSection title="Required permissions"><ul>{(help.permissions.length ? help.permissions : ["No additional permission specified"]).map((permission) => <li key={permission}>{permission}</li>)}</ul></HelpSection><HelpSection title="Common mistakes"><ul>{help.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul></HelpSection><HelpSection title="How DAENEM validates it"><p>{help.validation}</p></HelpSection>{help.notes && <div className={styles.guidanceNote}><TriangleAlert size={16} /><p>{help.notes}</p></div>}<a className={styles.sourceLink} href={help.officialSourceUrl} target="_blank" rel="noreferrer">{help.officialSourceTitle}<ExternalLink size={14} /></a></div>}</SheetContent></Sheet>

    <Dialog open={Boolean(secretType)} onOpenChange={(open) => { if (!open) { setSecretType(null); setSecretValue(""); } }}><DialogContent><DialogHeader><DialogTitle>{snapshot.credentials[secretType || ""]?.configured ? "Replace" : "Configure"} {META_FIELD_DEFINITIONS.find((field) => field.key === secretType)?.label}</DialogTitle><DialogDescription>The value is sent only to the authenticated server, encrypted, and never returned. A failed validation does not replace an active credential.</DialogDescription></DialogHeader><div className={styles.secretDialog}><Label htmlFor="secret-replacement">New secret</Label><Input id="secret-replacement" type="password" value={secretValue} onChange={(event) => setSecretValue(event.target.value)} autoComplete="new-password" spellCheck={false} /><p><EyeOff size={14} />Existing secret values cannot be revealed or pre-filled.</p>{secretType === "webhook_verify_token" && secretValue && <Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(secretValue); toast.success("One-time value copied."); }}><Copy size={14} />Copy one-time value</Button>}</div><DialogFooter><Button variant="outline" onClick={() => { setSecretType(null); setSecretValue(""); }}>Cancel</Button><Button onClick={() => void replaceSecret()} disabled={!secretValue || saving || !serverAvailable}>{saving ? "Validating…" : "Validate and save"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(ownerApproval)} onOpenChange={(open) => { if (!open) cancelOwnerApproval(); }}>
      <DialogContent data-testid="meta-owner-approval-dialog">
        <DialogHeader>
          <DialogTitle>Manual Owner Authorization Required</DialogTitle>
          <DialogDescription>
            Only the verified FarmPortal Owner may authorize this exact change. Your password is checked again, and the approval expires in two minutes, can be used once, and cannot approve a different action.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.secretDialog}>
          <strong>{ownerApproval?.action || "Protected Meta Change"}</strong>
          <code>{ownerApproval?.method || ""} /api/admin/integrations/meta/{ownerApproval?.path || ""}</code>
          <Label htmlFor="meta-owner-step-up-password">Confirm Your Owner Password</Label>
          <Input id="meta-owner-step-up-password" data-testid="meta-owner-password"
            type="password" value={ownerPassword}
            onChange={(event) => setOwnerPassword(event.target.value)}
            autoComplete="current-password" spellCheck={false} />
          <p><LockKeyhole size={14} />Your password and the resulting one-time approval token are never stored in the browser history or diagnostic log.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cancelOwnerApproval} disabled={ownerApproving}>Cancel</Button>
          <Button onClick={() => void confirmOwnerApproval()}
            disabled={ownerPassword.length < 6 || ownerApproving}>
            {ownerApproving ? "Verifying Owner…" : "Authorize This Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Posture({ label, value, icon: Icon, state }: { label: string; value: string; icon: typeof ShieldCheck; state: "good" | "warn" | "bad" }) { return <article className={styles.posture}><span className={state === "good" ? styles.iconGood : state === "bad" ? styles.iconBad : styles.iconWarn}><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></article>; }
function Asset({ title, value, icon: Icon }: { title: string; value: string; icon: typeof ShieldCheck }) { return <article className={styles.asset}><span><Icon size={18} /></span><div><small>{title}</small><strong>{value}</strong></div><ChevronRight size={16} /></article>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className={styles.empty}><Database size={24} /><strong>{title}</strong><p>{detail}</p></div>; }
function HelpSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3>{title}</h3>{children}</section>; }
function Overview({ snapshot, openHelp }: { snapshot: Snapshot; openHelp: (help: MetaHelpRecord) => void }) { return <div className={styles.overviewGrid}><section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Configuration posture</span><h2>Farms remains available</h2><p>Meta availability affects only features that declare a Meta capability dependency.</p></div><ShieldCheck size={20} /></div><div className={styles.readiness}><div><span>Business Portfolio</span><strong>{snapshot.configuration.business_portfolio_id ? "Configured" : "Not configured"}</strong></div><div><span>Meta App</span><strong>{snapshot.configuration.meta_app_id ? "Configured" : "Pending"}</strong></div><div><span>Access Token</span><strong>{snapshot.credentials.system_user_access_token?.validationState || "Not configured"}</strong></div><div><span>App Secret</span><strong>{snapshot.credentials.meta_app_secret?.validationState || "Pending Meta issue"}</strong></div><div><span>WABA</span><strong>{snapshot.configuration.waba_id ? "Configured" : "Not configured"}</strong></div><div><span>Phone number</span><strong>{snapshot.configuration.phone_number_id ? "Configured" : "Not configured"}</strong></div></div></section><section className={styles.surface}><div className={styles.surfaceHeading}><div><span className={styles.eyebrow}>Security boundary</span><h2>No hardcoded credentials</h2></div><LockKeyhole size={20} /></div><ul className={styles.checkList}><li><CheckCircle2 size={15} />Encrypted credential versions</li><li><CheckCircle2 size={15} />No plaintext readback</li><li><CheckCircle2 size={15} />Atomic candidate promotion</li><li><CheckCircle2 size={15} />Immediate cache invalidation</li><li><CheckCircle2 size={15} />Capability-specific degradation</li><li><CheckCircle2 size={15} />Signed webhooks fail closed</li></ul><button type="button" className={styles.helpButton} onClick={() => { const entry = META_HELP_REGISTRY.find((item) => item.credentialType === "system_user_access_token"); if (entry) openHelp(entry); }}><CircleHelp size={14} />Open credential guidance</button></section></div>; }
