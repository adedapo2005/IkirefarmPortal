"use client";

import React, { useMemo, useState } from "react";
import {
  Archive,
  Camera,
  FileCheck2,
  FileClock,
  FileSearch,
  FileUp,
  FolderLock,
  History,
  Link2,
  LockKeyhole,
  ScanLine,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Btn, Chip, Panel } from "./Common";
import { canPage, type Persona } from "@/lib/portal-model";

type FilesEvidenceCentreProps = {
  person: Persona;
  go: (route: string) => void;
};

const families = [
  ["Photos & Video", "Farm observations, inspections, delivery proof and authorized camera evidence."],
  ["Reports & Forms", "Generated or uploaded reports and evidence-backed operational forms."],
  ["Invoices & Receipts", "Commercial evidence linked to the authorized finance or procurement record."],
  ["HR Documents", "Restricted employee evidence shown only through the relevant HR record scope."],
  ["Compliance Evidence", "Biosecurity, inspection, health, maintenance and policy evidence where authorized."],
  ["Construction Evidence", "Project photographs, quotations, invoices, voice notes and source documents."],
] as const;

const lifecycle = [
  ["1", "Capture / Select", "Employee selects a permitted source file or authorized capture action."],
  ["2", "Validate / Scan", "Type, size, safety and permission checks complete before storage."],
  ["3", "Store / Link", "Server stores evidence and links it to the exact authorized business record."],
  ["4", "Audit / Retain", "Immutable receipt, access history and retention policy remain traceable."],
] as const;

export default function FilesEvidenceCentre({ person, go }: FilesEvidenceCentreProps) {
  const [query, setQuery] = useState("");
  const visibleFamilies = useMemo(
    () => families.filter(([title, detail]) => `${title} ${detail}`.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );
  const canOpenCamera = canPage(person, "cameras");
  const canOpenAudit = canPage(person, "audit");

  return (
    <div className="stack files-evidence-centre" data-files-evidence-centre="source-gated">
      <Panel
        title="Files & Evidence"
        description="One governed evidence workspace; business records remain authoritative in their owning modules."
      >
        <div className="row between wrap">
          <div className="stack tight">
            <Chip tone="amber">SOURCE-GATED · NO INVENTED FILE RECORDS</Chip>
            <p>
              No file is shown as uploaded, scanned, stored, linked, downloaded or retained unless the approved storage
              and record authorities confirm that state for this employee.
            </p>
          </div>
          <FolderLock size={34} aria-hidden="true" />
        </div>
        <div className="row wrap mt">
          {canOpenCamera && <Btn small onClick={() => go("cameras")}><Camera size={15} />Camera & Evidence</Btn>}
          {canOpenAudit && <Btn small onClick={() => go("audit")}><History size={15} />Audit Logs</Btn>}
        </div>
      </Panel>

      <Panel
        title="Evidence Families"
        description="Find the type of evidence you need without creating a duplicate business-record system."
      >
        <label className="field">
          <span>Filter Evidence Families</span>
          <span className="row">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Filter Evidence Families"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Photos, invoices, compliance, HR..."
            />
          </span>
        </label>
        {visibleFamilies.length ? (
          <div className="grid2 mt">
            {visibleFamilies.map(([title, detail]) => (
              <div className="state-surface" key={title} data-evidence-family={title}>
                <FileSearch size={21} aria-hidden="true" />
                <strong>{title}</strong>
                <p>{detail}</p>
                <span className="metadata">No authoritative file list connected in this source-gated view.</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="state-surface mt" role="status">
            <FileSearch size={22} aria-hidden="true" />
            <strong>No Matching Evidence Family</strong>
            <p>Clear or change the filter. This is not a claim that business records do not contain evidence.</p>
          </div>
        )}
      </Panel>

      <Panel
        title="Secure Evidence Lifecycle"
        description="A filename or browser preview is never treated as proof of storage."
      >
        <div className="grid2">
          {lifecycle.map(([step, title, detail]) => (
            <div className="state-surface" key={step}>
              <span className="eyebrow">{step}</span>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          ))}
        </div>
        <div className="row wrap mt">
          <Chip tone="gray"><FileUp size={14} />Upload Authority Required</Chip>
          <Chip tone="gray"><ScanLine size={14} />Safety Scan Required</Chip>
          <Chip tone="gray"><Link2 size={14} />Record Linkage Required</Chip>
          <Chip tone="gray"><FileCheck2 size={14} />Server Receipt Required</Chip>
        </div>
      </Panel>

      <div className="grid2">
        <Panel
          title="Access & Download Boundary"
          description="Evidence visibility and export follow the owning record, employee scope and file permission."
        >
          <div className="stack tight">
            <LockKeyhole size={24} aria-hidden="true" />
            <p>Sensitive HR, security, finance and customer evidence must never appear because a user can see this page.</p>
            <p>Download and export controls stay unavailable until the backend confirms permission for the exact evidence record.</p>
            <Chip tone="gray">ZERO DISCLOSURE BY DEFAULT</Chip>
          </div>
        </Panel>

        <Panel
          title="Retention & Provenance"
          description="Keep where evidence came from, what happened to it and when it may be archived."
        >
          <div className="stack tight">
            <FileClock size={24} aria-hidden="true" />
            <p>Expected provenance: source, actor, uploaded time, business record, checksum/hash where supported, revision and storage receipt.</p>
            <p>Retention and deletion must be policy-driven and audited; the client cannot silently destroy evidence.</p>
            <Chip tone="gray"><Archive size={14} />POLICY / BACKEND REQUIRED</Chip>
          </div>
        </Panel>
      </div>

      <Panel
        title="Evidence Register"
        description="The real register appears only after authorized storage and record linkage are connected."
      >
        <div className="state-surface" role="status">
          <ShieldCheck size={24} aria-hidden="true" />
          <strong>No Authoritative Evidence Register Connected</strong>
          <p>
            No synthetic filenames, upload dates, file sizes, owners or download states are shown. Open the owning
            business record for evidence that its authorized backend already exposes.
          </p>
        </div>
      </Panel>

      <div className="auth-state" role="status">
        <ShieldCheck size={17} aria-hidden="true" /> Files & Evidence remains source-gated. Secure upload, scanning, storage,
        authorized downloads, record linkage, access history and retention enforcement stay open until their backend contracts
        and denial tests pass.
      </div>
    </div>
  );
}
