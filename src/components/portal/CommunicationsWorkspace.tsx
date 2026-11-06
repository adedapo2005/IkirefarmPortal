"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  LockKeyhole,
  Mail,
  MessagesSquare,
  Paperclip,
  PauseCircle,
  ShieldCheck,
  UserRound,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { Btn, Chip, Panel, SelectField } from "./Common";
import { SmartTextarea } from "@/components/ui/smart-input";
import type { WorkspaceProps } from "./PortalExperience";
import { has } from "@/lib/portal-model";
import {
  COMMUNICATION_PERMISSIONS,
  HR_COMMUNICATION_PERMISSIONS,
  aiOperationsForMode,
  approvalFingerprint,
  approvalStillValid,
  canQueueJob,
  canUseHrCommunication,
  customerOrderFixture,
  hrInterviewFixture,
  providerStateLabel,
  sanitizeAiContext,
  v73PolicyFixture,
  whatsappAccountFixture,
  type AiMode,
  type CommunicationChannel,
  type CommunicationApproval,
  type OutboundArtifact,
} from "@/lib/communications-core";
import { localCommunicationsBackendStatus } from "@/lib/communications-backend";

type Area =
  | "Inbox"
  | "Assigned To Me"
  | "Unassigned"
  | "Priority"
  | "Customers"
  | "Suppliers"
  | "Employees / HR"
  | "Automations"
  | "Templates"
  | "Review / Approval Queue"
  | "Analytics"
  | "Settings";

const areas: Area[] = [
  "Inbox",
  "Assigned To Me",
  "Unassigned",
  "Priority",
  "Customers",
  "Suppliers",
  "Employees / HR",
  "Automations",
  "Templates",
  "Review / Approval Queue",
  "Analytics",
  "Settings",
];

const channelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];
const aiModeOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "manual_only", label: "Manual Only" },
  { value: "ai_assisted", label: "AI Assisted" },
  { value: "event_draft", label: "Event Draft" },
  { value: "approved_deterministic_automation", label: "Approved Deterministic Automation" },
];

function Status({ children, tone = "amber" }: { children: React.ReactNode; tone?: string }) {
  return <Chip tone={tone}>{children}</Chip>;
}

function FactList({ facts }: { facts: Readonly<Record<string, string | number | boolean>> }) {
  return (
    <dl className="v73-facts">
      {Object.entries(facts).map(([key, value]) => (
        <div key={key}>
          <dt>{key.replaceAll("_", " ")}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Composer({
  person,
  domain,
  onNotice,
}: {
  person: WorkspaceProps["person"];
  domain: "general" | "hr";
  onNotice: (notice: string) => void;
}) {
  const [channel, setChannel] = useState<CommunicationChannel>("whatsapp");
  const [aiMode, setAiMode] = useState<AiMode>("ai_assisted");
  const [operation, setOperation] = useState("generate");
  const [content, setContent] = useState<string>(domain === "hr" ? hrInterviewFixture.draft : customerOrderFixture.draft);
  const [approved, setApproved] = useState<CommunicationApproval | null>(null);
  const [attachment, setAttachment] = useState(false);
  const [edited, setEdited] = useState(false);
  const facts = domain === "hr" ? hrInterviewFixture.lockedFacts : customerOrderFixture.lockedFacts;
  const sourceRecordId = domain === "hr" ? hrInterviewFixture.sourceRecordId : customerOrderFixture.sourceRecordId;
  const artifact: OutboundArtifact = useMemo(
    () => ({
      recipient: domain === "hr" ? "Synthetic Candidate" : "Synthetic Customer",
      sender: whatsappAccountFixture.senderAddress,
      channel,
      content,
      templateVersion: null,
      language: "en-NG",
      attachmentIds: attachment ? ["attachment-fixture"] : [],
      linkIds: [],
      sourceEvent: sourceRecordId,
      policyVersion: v73PolicyFixture.id,
    }),
    [attachment, channel, content, domain, sourceRecordId],
  );
  const operations = aiOperationsForMode(aiMode);
  const aiAllowed = has(person, COMMUNICATION_PERMISSIONS.aiGenerate) || has(person, COMMUNICATION_PERMISSIONS.aiRefine);
  const sendAllowed = has(person, COMMUNICATION_PERMISSIONS.send);
  const decision = canQueueJob({
    person,
    artifact,
    providerState: whatsappAccountFixture.providerState,
    approval: approved,
    aiGenerated: aiMode !== "disabled" && aiMode !== "manual_only",
    policy: v73PolicyFixture,
  });

  const generate = () => {
    if (aiMode === "disabled") return;
    if (!aiAllowed) {
      onNotice("AI generation is outside this principal's communications policy.");
      return;
    }
    const prefix = operation === "shorten" ? "Short update: " : operation === "translate" ? "[en-NG translation fixture] " : "";
    const next = `${prefix}${domain === "hr" ? "Your interview remains scheduled for 2026-10-05 at 10:00 Africa/Lagos." : "Your order SO-V73-001 remains Ready for dispatch."}`;
    setContent(next);
    setApproved(null);
    setEdited(false);
    onNotice("AI-assisted wording fixture generated. Locked source facts were preserved; human review is required.");
  };
  const edit = (value: string) => {
    setContent(value);
    setEdited(true);
    setApproved(null);
  };
  const requestApproval = () => {
    if (!sendAllowed) {
      onNotice("Send permission is not granted to this principal.");
      return;
    }
    const id = `approval-${sourceRecordId}`;
    setApproved({
      id,
      jobId: `job-${sourceRecordId}`,
      approverId: person.id,
      approverRole: person.job,
      fingerprint: approvalFingerprint(artifact),
      state: "approved",
      approvedAt: new Date().toISOString(),
      policyVersion: v73PolicyFixture.id,
    });
    onNotice("Approval fixture recorded against the exact outbound artifact. Provider remains unconfigured.");
  };
  const queue = () => {
    const result = canQueueJob({
      person,
      artifact,
      providerState: whatsappAccountFixture.providerState,
      approval: approved,
      aiGenerated: aiMode !== "disabled" && aiMode !== "manual_only",
      policy: v73PolicyFixture,
    });
    onNotice(result.allowed ? "Simulated job queued; no provider call or message send occurred." : `Queue blocked: ${result.reason.replaceAll("_", " ")}.`);
  };
  return (
    <section className="v73-composer" aria-labelledby="v73-composer-title">
      <div className="v73-section-head">
        <div>
          <span className="eyebrow"><WandSparkles size={15} /> AI-ASSISTED COMMUNICATION</span>
          <h3 id="v73-composer-title">Reusable message composer</h3>
          <p>Wording assistance only. Authoritative facts remain locked and every fresh AI draft requires human review.</p>
        </div>
        <Status>PROVIDER INTEGRATION REQUIRED</Status>
      </div>
      <div className="v73-composer-grid">
        <div className="v73-composer-form">
          <div className="v73-field-grid">
            <SelectField label="Channel" value={channel} onChange={(value) => setChannel(value as CommunicationChannel)} options={channelOptions} />
            <SelectField label="AI execution mode" value={aiMode} onChange={(value) => setAiMode(value as AiMode)} options={aiModeOptions} />
          </div>
          <div className="v73-ai-actions" aria-label="AI operations">
            {["generate", "refine", "shorten", "expand", "rephrase", "personalize", "translate", "adjust tone", "alternatives", "summarize", "suggest reply", "create template draft"].map((item) => (
              <Btn key={item} small disabled={aiMode === "disabled" || !operations.length || !aiAllowed} onClick={() => { setOperation(item); generate(); }}>
                {item}
              </Btn>
            ))}
          </div>
          <div className="field v73-message-field">
            <span>Final message draft <small>{aiMode === "disabled" ? "USER INPUT" : "AI-GENERATED TEXT · REVIEW REQUIRED"}</small></span>
            <SmartTextarea
              value={content}
              onValueChange={edit}
              rows={7}
              aria-describedby="v73-fact-lock"
              label="Smart Writing Assist"
              description="Local correction and predictive suggestions only · Tab accepts the first suggestion · no provider transmission"
              suggestions={["approval", "delivery", "employee", "message", "order", "please", "review", "schedule", "update"]}
            />
          </div>
          <div className="v73-approval-row">
            <Btn small onClick={requestApproval} disabled={!content.trim() || !sendAllowed}><FileCheck2 size={15} /> Request / record approval</Btn>
            <Btn small primary onClick={queue} disabled={!approved || !approvalStillValid(approved, artifact)}><MessagesSquare size={15} /> Queue simulated job</Btn>
            {edited && approved && !approvalStillValid(approved, artifact) && <Status tone="red">APPROVAL INVALIDATED BY EDIT</Status>}
          </div>
          <p className="form-note" id="v73-fact-lock">Fresh AI text is never auto-sent. This fixture cannot call WhatsApp, Email, or SMS.</p>
        </div>
        <aside className="v73-grounding" aria-label="Authorized communication context">
          <div className="v73-grounding-head"><ShieldCheck size={18} /><strong>SOURCE FACTS · LOCKED</strong></div>
          <FactList facts={facts} />
          <div className="v73-grounding-head"><Bot size={18} /><strong>AI CONTEXT PROVENANCE</strong></div>
          <ul className="v73-check-list"><li>USER INSTRUCTION — operation selection</li><li>SYSTEM / POLICY — {v73PolicyFixture.id}</li><li>AUTHORIZED SOURCE DATA — {sourceRecordId}</li><li>AI OUTPUT — reviewable wording only</li></ul>
          {attachment && <div className="v73-attachment"><Paperclip size={15} /> Attachment fixture is not sent</div>}
          <label className="row v73-toggle"><input type="checkbox" checked={attachment} onChange={(event) => setAttachment(event.target.checked)} /> Include authorized attachment fixture</label>
          <div className="v73-queue-decision"><span>Current policy decision</span><strong>{decision.allowed ? "SIMULATED JOB ALLOWED" : decision.reason.replaceAll("_", " ")}</strong></div>
        </aside>
      </div>
    </section>
  );
}

function ConversationList({ area, canHr }: { area: Area; canHr: boolean }) {
  const rows = area === "Employees / HR" && canHr
    ? [{ title: "Synthetic HR interview fixture", detail: "Private HR · approval required", icon: <LockKeyhole size={16} /> }]
    : area === "Employees / HR"
      ? []
      : [{ title: "Synthetic customer order", detail: "WhatsApp · assignment pending", icon: <MessagesSquare size={16} /> }, { title: "Supplier delivery update", detail: "Email · unassigned", icon: <Mail size={16} /> }];
  return <div className="v73-conversation-list">{rows.length ? rows.map((row) => <button key={row.title} className="v73-conversation-row"><span className="v73-row-icon">{row.icon}</span><span><strong>{row.title}</strong><small>{row.detail}</small></span><ChevronRight size={16} /></button>) : <div className="v73-empty-private"><LockKeyhole size={18} /><strong>{canHr ? "No HR conversations in this view" : "HR communications are outside your authorized scope"}</strong><p>{canHr ? "Select a private HR conversation to continue." : "Private employee records are not disclosed to this communications principal."}</p></div>}</div>;
}

export default function CommunicationsWorkspace({ person }: WorkspaceProps) {
  const [area, setArea] = useState<Area>("Inbox");
  const [domain, setDomain] = useState<"general" | "hr">("general");
  const [notice, setNotice] = useState("");
  const [aiMode, setAiMode] = useState<AiMode>(v73PolicyFixture.aiMode);
  const [templateState, setTemplateState] = useState<"paused" | "retired">("paused");
  const [emergencyStop, setEmergencyStop] = useState(v73PolicyFixture.emergencyStop);
  const canHr = canUseHrCommunication(person);
  const canView = has(person, COMMUNICATION_PERMISSIONS.view);
  const canManage = has(person, COMMUNICATION_PERMISSIONS.manage) || has(person, COMMUNICATION_PERMISSIONS.settingsManage);
  const sourceFacts = domain === "hr" ? hrInterviewFixture.lockedFacts : customerOrderFixture.lockedFacts;
  const sanitized = sanitizeAiContext({ ...sourceFacts, otp: "REDACTED", session: "REDACTED" });
  const backendStatus = localCommunicationsBackendStatus();
  const showComposer = area === "Inbox" || area === "Assigned To Me" || area === "Priority" || area === "Employees / HR";

  if (!canView) {
    return <Panel className="v73-comms-root" title="Communications" description="Permission-controlled workspace"><div className="v73-denied"><LockKeyhole size={22} /><strong>Communications access is not assigned</strong><p>This principal receives no conversation, HR, customer, provider, or AI context.</p></div></Panel>;
  }

  return (
    <div className="v73-comms-root" data-v73-communications>
      <header className="v73-comms-hero">
        <div><span className="eyebrow"><MessagesSquare size={16} /> FARMS COMMUNICATIONS CORE</span><h2>Communications workspace</h2><p>One policy-aware foundation for WhatsApp, Email, SMS, HR, AI assistance, approvals and audit history.</p></div>
        <div className="v73-hero-status"><Status tone="amber">WhatsApp · {providerStateLabel(whatsappAccountFixture.providerState)}</Status><small>V75 {backendStatus.persistence} · no real provider calls or messages</small></div>
      </header>
      <nav className="v73-area-nav" aria-label="Communications areas">
        {areas.map((item) => <button key={item} className={area === item ? "active" : ""} onClick={() => { setArea(item); if (item === "Employees / HR") setDomain(canHr ? "hr" : "general"); }}>{item}</button>)}
      </nav>
      {notice && <div className="v73-notice" role="status"><Check size={16} />{notice}<button aria-label="Dismiss notice" onClick={() => setNotice("")}><XCircle size={15} /></button></div>}
      <div className="v73-summary-grid">
        <div><strong>12</strong><span>Core areas</span></div><div><strong>WhatsApp</strong><span>Primary channel · integration required</span></div><div><strong>{canHr ? "PRIVATE HR" : "ZERO HR DISCLOSURE"}</strong><span>Domain boundary</span></div><div><strong>AI {aiMode === "disabled" ? "OFF" : "ASSISTED"}</strong><span>Human review policy</span></div>
      </div>
      {area === "Employees / HR" && !canHr ? <Panel title="Employees / HR" description="Separate HR communications domain"><div className="v73-denied"><LockKeyhole size={22} /><strong>Private HR communications unavailable</strong><p>General communications permission does not reveal recruitment, leave, training, payroll, discipline, or employee records.</p></div></Panel> : (
        <>
          {area === "Employees / HR" && <div className="v73-private-banner"><LockKeyhole size={17} /><strong>PRIVATE HR COMMUNICATIONS</strong><span>Requires communications.view + HR authority. Read receipts never prove acknowledgement or completion.</span></div>}
          <div className="v73-workspace-grid">
            <Panel title={area} description={area === "Employees / HR" ? "HR conversations are isolated from customer service" : "Fixture records only · provider state is truthful"} className="v73-inbox-panel">
              <div className="v73-list-controls"><label className="field"><span>Domain</span><select value={domain} onChange={(event) => setDomain(event.target.value as "general" | "hr")}><option value="general">General communications</option>{canHr && <option value="hr">Private HR</option>}</select></label><Status tone="blue">{area === "Priority" ? "Priority queue" : "Assigned / unassigned view"}</Status></div>
              <ConversationList area={area} canHr={canHr} />
              {showComposer && <div className="v73-demo-picker"><Btn small onClick={() => { setDomain("hr"); setArea("Employees / HR"); setNotice("HR interview communication fixture selected. Locked interview facts are preserved."); }} disabled={!canHr}><UserRound size={15} /> HR interview demo</Btn><Btn small onClick={() => { setDomain("general"); setArea("Inbox"); setNotice("Customer order communication fixture selected. Locked order facts are preserved."); }}><MessagesSquare size={15} /> Customer order demo</Btn></div>}
            </Panel>
            {showComposer && <Composer person={person} domain={domain} onNotice={setNotice} />}
          </div>
        </>
      )}
      {area === "Automations" && <Panel title="Automations" description="Event drafts and approved deterministic templates are represented; no event executes"><div className="v73-control-grid"><div><h3>Event Draft</h3><p>Interview scheduled → prepare a draft → human review.</p><Status tone="blue">BACKEND EVENT REQUIRED</Status></div><div><h3>Approved Deterministic Send</h3><p>Frozen approved template only; fresh AI text is denied.</p><Status tone="amber">PROVIDER INTEGRATION REQUIRED</Status></div><div><h3>Emergency stop</h3><button className="v73-switch" aria-pressed={emergencyStop} onClick={() => setEmergencyStop((value) => !value)}>{emergencyStop ? "ON · jobs blocked" : "OFF · policy fixture"}</button></div></div></Panel>}
      {area === "Templates" && <Panel title="Templates" description="Versioned, approval-bound and domain-scoped"><div className="v73-template-card"><FileText size={20} /><div><strong>Interview Reminder · v2</strong><p>HR · WhatsApp · paused fixture</p></div><Status tone="amber">{templateState.toUpperCase()}</Status><Btn small onClick={() => setTemplateState((state) => state === "paused" ? "retired" : "paused")}><PauseCircle size={15} />{templateState === "paused" ? "Retire" : "Keep paused"}</Btn></div><p className="form-note">Paused or retired templates cannot be selected for sending. Material edits invalidate the prior approval fingerprint.</p><div className="v73-template-card"><Check size={20} /><div><strong>Customer Order Update · approved fixture</strong><p>General · WhatsApp · deterministic content</p></div><Status tone="blue">DESIGN READY</Status></div></Panel>}
      {area === "Review / Approval Queue" && <Panel title="Review / Approval Queue" description="Exact artifact binding prevents edited messages from using old approval"><div className="v73-approval-card"><div><FileCheck2 size={21} /><strong>HR interview fixture</strong><p>Recipient, sender, message, policy and source event bound.</p></div><Status tone="amber">PENDING REVIEW</Status><span>Provider not configured</span></div><div className="v73-approval-card"><div><AlertTriangle size={21} /><strong>Paused template</strong><p>Template selection is blocked until a new approved version exists.</p></div><Status tone="red">BLOCKED</Status></div></Panel>}
      {area === "Analytics" && <Panel title="Analytics" description="No provider metrics are fabricated"><div className="v73-analytics-grid"><div><strong>Provider delivery</strong><span>Unavailable — no provider evidence</span></div><div><strong>AI generation</strong><span>Fixture events only · no model usage claim</span></div><div><strong>Cost</strong><span>0 recorded · no provider connected</span></div><div><strong>Audit</strong><span>Concepts designed · backend persistence required</span></div></div></Panel>}
      {area === "Settings" && <SettingsPanel aiMode={aiMode} setAiMode={setAiMode} canManage={canManage} sanitized={sanitized} />}
      {area !== "Employees / HR" && area !== "Inbox" && area !== "Assigned To Me" && area !== "Unassigned" && area !== "Priority" && area !== "Automations" && area !== "Templates" && area !== "Review / Approval Queue" && area !== "Analytics" && area !== "Settings" && <Panel title={area} description="Shared communications core view"><ConversationList area={area} canHr={canHr} /></Panel>}
    </div>
  );
}

function SettingsPanel({ aiMode, setAiMode, canManage, sanitized }: { aiMode: AiMode; setAiMode: (mode: AiMode) => void; canManage: boolean; sanitized: Readonly<Record<string, unknown>> }) {
  const [challenge, setChallenge] = useState<"not_started" | "provider_required">("not_started");
  return <div className="v73-settings-grid">
    <Panel title="Channel availability" description="Policy fixture · no credentials collected"><div className="v73-setting-line"><span><MessagesSquare size={18} /> WhatsApp Business</span><Status tone="amber">INTEGRATION REQUIRED</Status></div><div className="v73-setting-line"><span><Mail size={18} /> Email</span><Status tone="amber">INTEGRATION REQUIRED</Status></div><div className="v73-setting-line"><span><MessagesSquare size={18} /> SMS</span><Status tone="gray">NOT CONFIGURED</Status></div></Panel>
    <Panel title="AI policy" description="AI is wording assistance, never an authority"><SelectField label="Execution mode" value={aiMode} onChange={(value) => setAiMode(value as AiMode)} options={aiModeOptions} /><p className="form-note">Allowed sources: authorized source records only. OTPs, sessions, private records, secrets and credentials are excluded.</p><div className="v73-context-preview"><strong>Context preview</strong><code>{JSON.stringify(sanitized)}</code></div></Panel>
    <Panel title="WhatsApp verification foundation" description="Interface and contract only · no real code is requested"><div className="v73-auth-flow"><span>1. Enter allowed contact</span><ChevronRight size={15} /><span>2. Request WhatsApp code</span><ChevronRight size={15} /><span>3. Verify contact</span><ChevronRight size={15} /><span>4. Re-check lifecycle, permission and farm scope</span></div><Status tone="amber">PROVIDER INTEGRATION REQUIRED</Status><p className="form-note">Verified phone ≠ approved employee. Code delivered/read ≠ authenticated. OTPs are never generated, stored, translated, or placed in inbox history.</p><Btn small onClick={() => setChallenge("provider_required")} disabled={!canManage}><LockKeyhole size={15} /> Request verification (fixture)</Btn>{challenge === "provider_required" && <p className="v73-inline-warning" role="status"><AlertTriangle size={15} /> Provider integration required; no code sent.</p>}</Panel>
    <Panel title="Operations and governance" description="Configuration UX only; backend policy required"><div className="v73-governance-grid"><span>Scope</span><strong>Organization · farm/site · module · use case · role · user</strong><span>Approval</span><strong>Named role / HR-specific / sensitive / dual</strong><span>Controls</span><strong>Quiet hours · fallback · budget · rate · retention · emergency stop</strong><span>Audit</span><strong>Draft → AI → edit → approve → queue → provider event</strong></div><div className="v73-capability-list">{[COMMUNICATION_PERMISSIONS.view, COMMUNICATION_PERMISSIONS.reply, COMMUNICATION_PERMISSIONS.send, COMMUNICATION_PERMISSIONS.aiGenerate, COMMUNICATION_PERMISSIONS.templatesApprove, COMMUNICATION_PERMISSIONS.auditView, ...HR_COMMUNICATION_PERMISSIONS].map((item) => <span key={item}>{item}</span>)}</div></Panel>
    <Panel title="Administrative boundary" description="Owner / authorized administrator only"><p>{canManage ? "This principal may view the policy fixture; changes are not persisted and no provider credentials are accepted." : "Settings management is not assigned to this principal."}</p><Status tone={canManage ? "blue" : "gray"}>{canManage ? "DESIGN READY" : "ACCESS RESTRICTED"}</Status></Panel>
  </div>;
}
