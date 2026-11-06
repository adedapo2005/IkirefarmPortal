"use client";

import React, { useState } from "react";
import {
  CloudOff,
  DatabaseZap,
  Files,
  Layers3,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { Btn, Chip, Panel, Timeline } from "./Common";

const surfaces = [
  ["Farm Operations", "Encrypted drafts only after server policy enables this record type."],
  ["Feed & Eggs", "Measurements stay unconfirmed until server acknowledgement."],
  ["Inventory & Sales", "Stock, price, reservation and settlement mutations remain blocked."],
  ["Finance & Banking", "No posting, transfer, confirmation or approval may occur offline."],
  ["Customer Communication", "Draft only; no send, delivery result or retry is implied."],
  ["Workflow & Files", "Evidence upload and transition wait for authenticated server validation."],
  ["Profile", "Only explicitly local display preferences may persist on the device."],
] as const;

type SyncMode = "ready" | "offline" | "syncing" | "partial" | "failed" | "conflict";

export default function SyncDesk() {
  const [mode, setMode] = useState<SyncMode>("ready");
  const [view, setView] = useState<"activity" | "contract" | "sessions">("activity");
  const [conflictChoice, setConflictChoice] = useState<"none" | "server" | "draft">("none");
  const title = {
    ready: "Connected design state",
    offline: "Offline design state",
    syncing: "Synchronization in progress",
    partial: "Partial synchronization",
    failed: "Failed synchronization",
    conflict: "Conflict review required",
  }[mode];

  return (
    <section className="sync-desk stack" aria-label="Offline and synchronization workbench">
      <div className="sync-desk-hero">
        <div>
          <span className="eyebrow">DEVICE & DATA BOUNDARY</span>
          <h2>{title}</h2>
          <p>
            SAMPLE / DESIGN FIXTURE · no queue, attachment, device record,
            provider call or server mutation exists in this private review.
          </p>
        </div>
        <span className={`sync-orb ${mode}`} aria-hidden="true">
          {mode === "offline" ? <WifiOff /> : mode === "conflict" || mode === "failed" ? <TriangleAlert /> : mode === "syncing" || mode === "partial" ? <RefreshCw /> : <ShieldCheck />}
        </span>
      </div>

      <div className="sync-mode-tabs" role="tablist" aria-label="Synchronization state fixtures">
        {(["ready", "offline", "syncing", "partial", "failed", "conflict"] as const).map((value) => (
          <button key={value} role="tab" aria-selected={mode === value} onClick={() => setMode(value)}>{value[0].toUpperCase() + value.slice(1)}</button>
        ))}
      </div>
      <div className="sync-subnav" role="tablist" aria-label="Synchronization review areas">
        {(["activity", "contract", "sessions"] as const).map((id) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>{id === "activity" ? "My sync activity" : id === "contract" ? "Queue & conflict contract" : "Owner sync & sessions"}</button>
        ))}
      </div>

      {view === "activity" && (
        <div className="sync-activity-layout">
          <Panel title="My device activity" description="Only the current sample identity; no other employee queue is exposed.">
            <Timeline items={[
              { time: "Last sync", title: "Not available", description: "A server acknowledgement timestamp is required." },
              { time: "Pending", title: mode === "offline" ? "Draft-only review state" : "No queued operations", description: "No encrypted queue has been provisioned." },
              { time: "Result", title: mode === "failed" ? "Sample rejection requires attention" : mode === "partial" ? "Some items await acknowledgement" : "No authoritative result", description: "Frontend state is not confirmation." },
            ]} />
          </Panel>
          <Panel title="Safe behavior by workspace">
            <div className="sync-surface-list">
              {surfaces.map(([name, detail]) => (
                <article key={name}>
                  <div><strong>{name}</strong><p>{detail}</p></div>
                  <Chip tone={mode === "ready" ? "gray" : "amber"}>{mode === "ready" ? "Backend contract required" : mode === "offline" ? "Blocked or draft-only" : mode === "syncing" ? "Awaiting acknowledgement" : "Manual review required"}</Chip>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {view === "contract" && (
        <div className="sync-contract-grid">
          {[
            [<ShieldCheck key="a" />, "Encrypted queue", "Per-user/device keys, bounded retention, protected attachments and sign-out purge policy."],
            [<DatabaseZap key="b" />, "Idempotent replay", "Server-issued operation ID, request fingerprint, retry budget and deterministic outcome."],
            [<Layers3 key="c" />, "Multi-tab ownership", "One elected sender, lease heartbeat, handoff and duplicate-submission suppression."],
            [<Files key="d" />, "Attachment resume", "Chunk identity, integrity hash, authorization recheck and resumable failure state."],
          ].map(([icon, heading, detail]) => (
            <article key={String(heading)}>{icon}<strong>{heading}</strong><p>{detail}</p><Chip tone="amber">BACKEND REQUIRED</Chip></article>
          ))}
          <Panel title="Conflict resolver" description="Preserve both versions until an authorized human decides.">
            <div className="conflict-compare">
              <button aria-pressed={conflictChoice === "server"} onClick={() => setConflictChoice("server")}><small>SERVER VERSION</small><strong>Authoritative reference unavailable</strong><span>Keep current confirmed record</span></button>
              <button aria-pressed={conflictChoice === "draft"} onClick={() => setConflictChoice("draft")}><small>DEVICE DRAFT</small><strong>Encrypted draft unavailable</strong><span>Prepare a reviewed merge</span></button>
            </div>
            <Btn disabled={conflictChoice === "none"} onClick={() => setConflictChoice("none")}>Prepare sample resolution</Btn>
            <p className="form-note">A production decision requires permission, reason, before/after values, actor, timestamp and immutable audit.</p>
          </Panel>
        </div>
      )}

      {view === "sessions" && (
        <div className="owner-sync-sessions">
          <section><CloudOff size={34} /><h2>No device sessions connected</h2><p>Owner monitoring may show only authorized session metadata and risk evidence—not employee content by default.</p></section>
          <Panel title="Required controls">
            <ul>
              <li>Scoped device and session inventory</li>
              <li>Queue age, failure class and encrypted-item count</li>
              <li>Remote revoke and sign-out contract</li>
              <li>Lost-device protection and credential rotation</li>
              <li>Exception alerts without cross-user data leakage</li>
            </ul>
            <Chip tone="amber">DESIGN COMPLETE · BACKEND REQUIRED</Chip>
          </Panel>
        </div>
      )}

      {(mode === "conflict" || mode === "failed" || mode === "partial") && (
        <div className="sync-blocked" role="status">
          <CloudOff size={20} />
          <div>
            <strong>{mode === "conflict" ? "Preserve both values" : mode === "partial" ? "Do not infer missing acknowledgements" : "Stop automated retry"}</strong>
            <p>Inventory, finance, health, movement, banking and communication records require a reviewed server outcome.</p>
          </div>
        </div>
      )}
    </section>
  );
}
