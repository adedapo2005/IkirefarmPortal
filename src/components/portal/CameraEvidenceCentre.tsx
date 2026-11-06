"use client";

import React from "react";
import {
  Archive,
  Camera,
  FileCheck2,
  FileUp,
  HardDrive,
  History,
  Images,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Video,
  WifiOff,
} from "lucide-react";
import { Btn, Chip, Panel } from "./Common";
import { canPage, type Persona } from "@/lib/portal-model";

type CameraEvidenceCentreProps = {
  person: Persona;
  go: (route: string) => void;
};

const readiness = [
  {
    id: "device-registry",
    title: "Camera / NVR Registry",
    detail: "Provider, device identity, assigned farm/location, health and last verified contact.",
    icon: HardDrive,
  },
  {
    id: "live-view",
    title: "Authorized Live View",
    detail: "A feed can render only after device authority, employee permission and source freshness are proven.",
    icon: Video,
  },
  {
    id: "mobile-capture",
    title: "Mobile Camera Capture",
    detail: "Photo/video evidence must retain actor, record context, time and upload outcome without becoming a gesture-only workflow.",
    icon: Smartphone,
  },
  {
    id: "upload-scan",
    title: "Upload & File Safety",
    detail: "Files require type/size validation, malware scanning where supported, storage authority and a durable upload receipt.",
    icon: ScanLine,
  },
  {
    id: "record-linkage",
    title: "Evidence Linkage",
    detail: "Every retained image, clip or document must attach to the correct authorized farm, flock, incident, delivery, inspection or record.",
    icon: FileCheck2,
  },
  {
    id: "access-events",
    title: "Device & Access Events",
    detail: "Viewer, device, action, time and result belong in an authorized event stream rather than client-side history.",
    icon: History,
  },
  {
    id: "retention",
    title: "Retention & Lifecycle",
    detail: "Retention, archive and deletion rules must come from policy and storage authority; the UI cannot silently destroy evidence.",
    icon: Archive,
  },
  {
    id: "evidence-integrity",
    title: "Evidence Integrity",
    detail: "Hash/checksum, source, upload result, revision and audit references should remain available where the backend supports them.",
    icon: ShieldCheck,
  },
];

export default function CameraEvidenceCentre({ person, go }: CameraEvidenceCentreProps) {
  const canOpenFiles = canPage(person, "files");
  const canOpenAudit = canPage(person, "audit");

  return (
    <div className="stack camera-evidence-centre" data-camera-evidence-centre="source-gated">
      <Panel
        title="Camera & Evidence Centre"
        description="Authorized visual evidence, device readiness and access history without fabricated feeds."
      >
        <div className="row between wrap">
          <div className="stack tight">
            <Chip tone="amber">Source-Gated - No Fabricated Video</Chip>
            <p>
              No camera, NVR, recording, thumbnail or access event is presented as real until the approved device and
              storage authorities provide it for this employee’s permitted scope.
            </p>
          </div>
          <Camera size={34} aria-hidden="true" />
        </div>
        <div className="row wrap mt">
          {canOpenFiles && <Btn small onClick={() => go("files")}><Images size={15} />Open Files & Evidence</Btn>}
          {canOpenAudit && <Btn small onClick={() => go("audit")}><History size={15} />Open Audit Logs</Btn>}
        </div>
      </Panel>

      <div className="grid2" aria-label="Camera and evidence capability readiness">
        {readiness.map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.id} title={item.title} description={item.detail} className="camera-evidence-capability">
              <div data-camera-evidence-capability={item.id} className="stack tight">
                <div className="row between">
                  <Icon size={22} aria-hidden="true" />
                  <Chip tone="gray">Authority Required</Chip>
                </div>
                <span className="metadata">
                  No operational state is inferred from browser hardware, local file selection, or design fixtures.
                </span>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel
        title="Camera Layout Readiness"
        description="Four layout positions are retained for review without implying that any physical camera is configured."
      >
        <div className="camera-grid" aria-label="Unavailable camera layout positions">
          {["Camera Position 01", "Camera Position 02", "Camera Position 03", "Camera Position 04"].map((label) => (
            <div className="camera-frame" key={label} data-camera-state="unavailable">
              <header><span>{label}</span><span>Unavailable</span></header>
              <WifiOff size={42} aria-hidden="true" />
              <strong>No Authorized Feed</strong>
              <small>Device / provider configuration required</small>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Capture & Upload Contract"
        description="What must be true before mobile or desktop evidence can be treated as recorded."
      >
        <div className="grid3">
          {[
            [FileUp, "1 · Capture / Select", "The employee chooses an authorized file or camera action."],
            [ScanLine, "2 · Validate / Scan", "Type, size, safety and permission checks complete before storage."],
            [FileCheck2, "3 · Link / Receipt", "Server confirms storage, record linkage and an auditable evidence receipt."],
          ].map(([Icon, title, detail]) => {
            const I = Icon as React.ElementType;
            return (
              <div className="state-surface" key={String(title)}>
                <I size={22} aria-hidden="true" />
                <strong>{String(title)}</strong>
                <p>{String(detail)}</p>
              </div>
            );
          })}
        </div>
        <p className="form-note mt">
          Selecting a filename is not an upload. A preview is not storage. A server-accepted upload is not a complete
          evidence record until its authorized business record and audit receipt are linked.
        </p>
      </Panel>

      <div className="auth-state" role="status">
        <ShieldCheck size={17} aria-hidden="true" /> Camera & Evidence remains source-gated. Device discovery, live video,
        secure upload, storage, access-event logging and retention enforcement stay open until their backend contracts and
        denial tests pass.
      </div>
    </div>
  );
}
