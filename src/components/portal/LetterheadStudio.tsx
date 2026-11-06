"use client";

import React, { useState } from "react";
import {
  Archive,
  Check,
  FileCheck2,
  FileText,
  MessageSquareText,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Persona } from "@/lib/portal-model";
import { has } from "@/lib/portal-model";
import { farmConfiguration } from "@/lib/review-metadata";
import { initialSupportWhatsapp } from "@/lib/communication-model";
import { Btn, Chip, Panel, SelectField, Timeline } from "./Common";

const documentTypes = [
  "Invoice",
  "Receipt",
  "Statement",
  "Paid-invoice communication",
  "Order confirmation",
  "Thank-you letter",
  "Customer email",
  "WhatsApp attachment",
];
const states = ["Draft", "Review", "Approved", "Published", "Archived"];

export default function LetterheadStudio({ person }: { person: Persona }) {
  const [type, setType] = useState("Invoice");
  const [variant, setVariant] = useState("Print / PDF");
  const [state, setState] = useState("Draft");
  const [proposal, setProposal] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState("");
  const canUseAi = has(person, "communication.ai.draft");

  return (
    <section className="letterhead-studio">
      <header className="letterhead-hero">
        <div>
          <span className="eyebrow">ADMINISTRATOR DOCUMENT SYSTEM</span>
          <h2>One approved identity, every customer document.</h2>
          <p>DESIGN FIXTURE · no PDF, email or WhatsApp attachment is generated or published.</p>
        </div>
        <FileCheck2 size={44} />
      </header>

      <div className="letterhead-toolbar">
        <SelectField label="Document type" value={type} onChange={(value) => { setType(value); setReviewed(false); }} options={documentTypes.map((value) => ({ value, label: value }))} />
        <SelectField label="Variant" value={variant} onChange={(value) => { setVariant(value); setReviewed(false); }} options={["Print / PDF", "Email", "WhatsApp"].map((value) => ({ value, label: value }))} />
        <SelectField label="Lifecycle state" value={state} onChange={setState} options={states.map((value) => ({ value, label: value }))} />
      </div>

      <div className="letterhead-workbench">
        <aside className="letterhead-inspector">
          <span className="eyebrow">APPROVED FACT SOURCES</span>
          <div><ShieldCheck /><strong>Official brand asset</strong><small>Owner supplied · geometry preserved</small></div>
          <div><Check /><strong>Farm configuration</strong><small>{farmConfiguration.address}</small></div>
          <div><MessageSquareText /><strong>Support setting</strong><small>{initialSupportWhatsapp} · administrator configurable</small></div>
          <div><FileText /><strong>Transaction fields</strong><small>Invoice, receipt, order and payment references require backend authority</small></div>
          <p>No company registration, bank, tax, customer or transaction fact is inferred.</p>
        </aside>

        <section className={`letterhead-canvas ${variant.toLowerCase().replaceAll(" / ", "-").replaceAll(" ", "-")}`} aria-label={`${type} ${variant} preview`}>
          <header>
            <img src="/assets/approved/daenem-logo.png" alt="Daenem Farms" />
            <div><small>{type.toUpperCase()} · SAMPLE</small><strong>Reference unavailable</strong></div>
          </header>
          <div className="letterhead-title">
            <span>SAMPLE / DESIGN FIXTURE</span>
            <h2>{type}</h2>
            <p>Prepared for an authorized customer record</p>
          </div>
          <div className="letterhead-lines"><i /><i /><i /><i /></div>
          <dl>
            <div><dt>Customer</dt><dd>Authoritative record required</dd></div>
            <div><dt>Transaction</dt><dd>Authoritative reference required</dd></div>
            <div><dt>Amount / status</dt><dd>Not supplied</dd></div>
          </dl>
          <footer><span>{farmConfiguration.name}</span><span>{initialSupportWhatsapp}</span></footer>
        </section>

        <aside className="letterhead-ai">
          <div className="ai-large-orb"><Sparkles /></div>
          <span className="eyebrow">AI LETTERHEAD GENERATOR</span>
          <h2>Propose layout—not facts.</h2>
          <p>AI may suggest spacing, typography, hierarchy and approved asset placement. Human review remains mandatory.</p>
          {canUseAi && <Btn onClick={() => { setProposal(true); setReviewed(false); setNotice("AI layout proposal simulated. No AI provider contacted and no document published."); }}>Generate sample layout proposal</Btn>}
          {proposal && <div className="ai-layout-proposal"><strong>PROPOSAL · NOT APPROVED</strong><p>Increase transaction hierarchy, reserve a compact evidence footer and use the official mark at its original aspect ratio.</p><label className="row"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I reviewed the proposal and approved facts</label></div>}
          <Btn primary disabled={!proposal || !reviewed} onClick={() => { setState("Review"); setNotice("Moved to Review in this session only. Backend versioning and approval are required."); }}>Send sample to human review</Btn>
          <p className="form-note">AI cannot publish, add company facts, financial values, customer records or bank details.</p>
        </aside>
      </div>

      <div className="letterhead-status">
        <Timeline items={states.map((item) => ({ time: item, title: state === item ? "Current sample state" : "Lifecycle gate", description: item === "Published" ? "Requires approved version, renderer, authorization and immutable audit." : "State transition requires authorized backend policy." }))} />
        <Panel title="Output readiness">
          <div className="letterhead-output-grid">
            <span><Printer /> Print / PDF <Chip tone="amber">Renderer required</Chip></span>
            <span><MessageSquareText /> Email <Chip tone="amber">Provider required</Chip></span>
            <span><Archive /> WhatsApp attachment <Chip tone="amber">Provider required</Chip></span>
          </div>
          {notice && <p className="cc-notice" role="status">{notice}</p>}
        </Panel>
      </div>
    </section>
  );
}
