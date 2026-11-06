"use client";

import React from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Fingerprint,
  History,
  Laptop,
  LockKeyhole,
  LogIn,
  Network,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
} from "lucide-react";
import { Btn, Chip, Panel } from "./Common";
import { canPage, type Persona } from "@/lib/portal-model";

type SecurityCentreProps = {
  person: Persona;
  go: (route: string) => void;
};

type Capability = {
  id: string;
  title: string;
  detail: string;
  authority: string;
  icon: React.ElementType;
  route?: "audit" | "rbac" | "permissions";
  routeLabel?: string;
};

const capabilities: Capability[] = [
  {
    id: "login-logs",
    title: "Login Logs",
    detail: "Successful and failed sign-in events, outcome reasons, and authorized context must come from the identity service.",
    authority: "Authoritative login-event source not accepted for Stage 21 UI consumption.",
    icon: LogIn,
  },
  {
    id: "active-sessions",
    title: "Active Sessions",
    detail: "Current and other sessions, last activity, and revoke controls must be backed by the session authority.",
    authority: "No session list or revoke action is represented as available without server authority.",
    icon: Laptop,
  },
  {
    id: "device-logs",
    title: "Device Logs",
    detail: "Browser/platform, first seen, last seen, and trust posture require an authenticated device registry.",
    authority: "No device history is inferred from browser-local information.",
    icon: Smartphone,
  },
  {
    id: "trusted-devices",
    title: "Trusted Devices",
    detail: "Trust state and revoke controls are displayed only when the backend exposes the actual device capability.",
    authority: "Backend permission, audit, and device authority remain required.",
    icon: Fingerprint,
  },
  {
    id: "mfa-recovery",
    title: "MFA & Recovery",
    detail: "Enrollment, recovery, enforcement, and method status remain controlled by the authentication service.",
    authority: "Frontend controls cannot claim MFA enrollment or enforcement.",
    icon: LockKeyhole,
  },
  {
    id: "role-scope",
    title: "Role & Data Scope",
    detail: "Review effective permissions and farm/company scope using the existing authorized access-control destination.",
    authority: "The server remains the authorization authority for every record and action.",
    icon: UserRoundCheck,
    route: "rbac",
    routeLabel: "Open Access Control",
  },
  {
    id: "permission-history",
    title: "Permission History",
    detail: "Before/after access, actor, reason, and effective time require immutable authorization history.",
    authority: "No permission-change history is invented when the source is unavailable.",
    icon: BookOpenCheck,
    route: "permissions",
    routeLabel: "Open Permissions",
  },
  {
    id: "audit-events",
    title: "Audit Logs",
    detail: "Searchable changes, approvals, imports, exports, and sensitive actions belong to the authorized audit source.",
    authority: "The existing Audit Logs destination remains separately permission-filtered.",
    icon: History,
    route: "audit",
    routeLabel: "Open Audit Logs",
  },
  {
    id: "security-alerts",
    title: "Security Alerts & Incidents",
    detail: "New-device, failed-attempt, privilege, or incident signals must have source evidence and an authorized response path.",
    authority: "No active incident count or severity is claimed from design fixtures.",
    icon: ShieldAlert,
  },
  {
    id: "step-up",
    title: "Step-up Verification",
    detail: "Sensitive financial and administration actions may require fresh verification when the backend policy explicitly requires it.",
    authority: "No client-only prompt is treated as security enforcement.",
    icon: ShieldCheck,
  },
  {
    id: "integration-security",
    title: "Integration Security",
    detail: "Connection scope, last synchronization, safe disconnect, and API-key lifecycle belong to each approved integration authority.",
    authority: "Secrets are never rendered; full credentials are never recoverable from this workspace.",
    icon: Network,
  },
];

export default function SecurityCentre({ person, go }: SecurityCentreProps) {
  return (
    <div className="stack security-centre" data-security-centre="source-gated">
      <Panel
        title="Security Centre"
        description="One source-gated view of account security, access, audit, and incident capabilities."
      >
        <div className="row between wrap">
          <div className="stack tight">
            <Chip tone="amber">Source-Gated - No Live Security Claims</Chip>
            <p>
              No live security record is displayed unless an authenticated backend authority supplies it for this employee,
              company, and permitted scope.
            </p>
          </div>
          <ShieldCheck size={34} aria-hidden="true" />
        </div>
        <p className="form-note mt">
          Missing authority is shown as unavailable rather than replaced with sample session counts, invented devices,
          fictional MFA status, or client-side enforcement.
        </p>
      </Panel>

      <div className="grid2" aria-label="Security Centre capabilities">
        {capabilities.map((capability) => {
          const Icon = capability.icon;
          const canOpen = capability.route ? canPage(person, capability.route) : false;
          return (
            <Panel
              key={capability.id}
              title={capability.title}
              description={capability.detail}
              className="security-capability"
            >
              <div data-security-capability={capability.id} className="stack tight">
                <div className="row between">
                  <Icon size={22} aria-hidden="true" />
                  <Chip tone={canOpen ? "blue" : "gray"}>
                    {canOpen ? "Authorized Destination" : "Backend Authority Required"}
                  </Chip>
                </div>
                <p>{capability.authority}</p>
                {capability.route && canOpen ? (
                  <Btn small onClick={() => go(capability.route!)}>
                    {capability.routeLabel}
                  </Btn>
                ) : (
                  <span className="metadata">No action is exposed until its permission and server contract exist.</span>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel
        title="Incident Response Pattern"
        description="Design fixture retained for visual/workflow review; it is not evidence of a real security incident."
      >
        <div className="row between wrap">
          <Chip tone="gray">Sample / Design Fixture</Chip>
          <span className="metadata">No case number, actor, event, or conclusion is asserted as real.</span>
        </div>
        <div className="grid3 mt">
          {[
            ["01", "Record evidence", "Capture the authorized source, time, scope, and immutable reference."],
            ["02", "Review access", "Confirm the reviewer is permitted to see the affected account and record."],
            ["03", "Decide & audit", "Record the human decision, reason, action, and audit receipt."],
          ].map(([step, title, detail]) => (
            <div className="state-surface" key={step}>
              <span className="eyebrow">{step}</span>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="auth-state" role="status">
        <AlertTriangle size={17} aria-hidden="true" /> Security Centre remains partially source-gated. Backend-owned session,
        device, MFA, login-event, and permission-history contracts must pass their own authorization, audit, and denial tests
        before those controls can be marked live.
      </div>
    </div>
  );
}
