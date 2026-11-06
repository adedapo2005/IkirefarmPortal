import React from "react";
import {CircleAlert, ShieldCheck} from "lucide-react";
import type {MetricContract} from "./metric-contract";
import {titleCase} from "../../../lib/ui-language";

// HTTP success alone does not certify the records: the producer can return an
// error metric when an in-scope verified record fails its integrity checks.
export function hasVerifiedProductionSource(metric: MetricContract): boolean {
  return metric.status === "ready" && metric.source.verified === true
    && metric.scope.authorized === true && Boolean(metric.scope.label.trim());
}

export default function ProductionSourceNotice({metric}: {metric: MetricContract}) {
  if (!hasVerifiedProductionSource(metric)) {
    return <div className="auth-state mt" role="status"><CircleAlert size={20} aria-hidden="true"/><span>Production source verification is unavailable. Review the source and scope before relying on these analytics.</span></div>;
  }
  const siteId = metric.scope.label;
  const displaySite = titleCase(siteId.replace(/[-_]+/g, " "));
  return <div className="auth-state mt"><ShieldCheck size={20} aria-hidden="true"/><span>Connected source: verified egg-batch records. Farm / Site: {displaySite} (formatted from site ID: {siteId}). Draft batches do not enter this metric.</span></div>;
}
