/**
 * Review-only build identity. This is deliberately separate from the production ERP
 * version. A static Site build cannot discover the receipt for the deployment that is
 * currently serving it, so source/build identity and the latest receipt already known
 * to that source are presented separately. Page-load time is never publication metadata.
 */
export type PublicationRecord = {
  reviewRevision: string;
  sourceCommit: string;
  publishedAtUtc: string;
  deploymentId: string;
  siteVersion: number;
  scope: string;
  zipStatus: "Not created" | "Created";
};

export const reviewMetadata = {
  reviewRevision: "V1.7-F2",
  sourceRevision: "v17-f2-signin-gate-closure-20260912",
  buildIdentity: "daenem-review-v17-f2-signin",
  zipRevision: "not-generated",
  environment: "PRIVATE CHATGPT SITE · DESIGN REVIEW",
  contentRevisionUpdatedUtc: "2026-09-12T23:07:43.000Z",
  runtimeDeploymentMetadataAvailable: false,
  lastVerifiedSiteReceipt: {
    reviewRevision: "V1.7-F1",
    sourceCommit: "148738eba32ee040753b0590220c3f653c0f1d18",
    publishedAtUtc: "2026-09-12T22:11:25.470173Z",
    deploymentId: "appgdep_6aa5cdaf9b488191b59b5f3152467112",
    siteVersion: 22,
    scope: "V1.7-F1 Sign-In implementation checkpoint and starting point for V1.7-F2 verification closure",
    zipStatus: "Not created",
  } satisfies PublicationRecord,
  publicationHistory: [
    {
      reviewRevision: "V1.7-E",
      sourceCommit: "74ccc8292e33e7e70f374771865cea2c8e1f21d4",
      publishedAtUtc: "2026-09-12T20:23:35.297750Z",
      deploymentId: "appgdep_6aa5b4bd39cc8191b411523bc03cbec9",
      siteVersion: 21,
      scope: "V1.7-E Owner correction checkpoint and starting point for the focused V1.7-F1 Sign-In pass",
      zipStatus: "Created",
    },
    {
      reviewRevision: "V1.7-E",
      sourceCommit: "6e96d9a781c41fd674fc7136a50658fc49ae8d43",
      publishedAtUtc: "2026-09-12T19:45:38.439395Z",
      deploymentId: "appgdep_6aa5ab80f0108191b99ac68279b001c5",
      siteVersion: 20,
      scope: "V1.7-E Sign-In recovery attempt; retained as the latest published checkpoint before the Owner correction pass",
      zipStatus: "Not created",
    },
    {
      reviewRevision: "V1.7-E",
      sourceCommit: "50183513f709a7a12776ada6769365e2dc56de95",
      publishedAtUtc: "2026-09-12T18:07:50.004294Z",
      deploymentId: "appgdep_6aa594a664f881919b46a3c994323c62",
      siteVersion: 19,
      scope: "V1.7-E interrupted checkpoint: Construction Intelligence, Enterprise Import, ten-theme and traceability expansion",
      zipStatus: "Not created",
    },
    {
      reviewRevision: "V1.7-D",
      sourceCommit: "ce1eeebb26c45a79752d4572ec18a1f9041d0af9",
      publishedAtUtc: "2026-09-12T07:34:02.403766Z",
      deploymentId: "appgdep_6aa50036b86c8191a4a0b7980b5bd109",
      siteVersion: 18,
      scope: "V1.7-D master completeness, feature preservation and implementation tracking",
      zipStatus: "Created",
    },
    {
      reviewRevision: "V1.7-C",
      sourceCommit: "74c15bc968e3de56f01bfaa0146cb149a7cae8aa",
      publishedAtUtc: "2026-09-12T06:26:43.059504Z",
      deploymentId: "appgdep_6aa4f09749b48191bd9f79525a52a865",
      siteVersion: 17,
      scope: "V1.7-C professional context, typography, entity access and first-view refinement",
      zipStatus: "Created",
    },
    {
      reviewRevision: "V1.7-B",
      sourceCommit: "d969033b9f166471f0dc9f5847cf9a6bcba61a38",
      publishedAtUtc: "2026-09-12T05:29:41.530690Z",
      deploymentId: "appgdep_6aa4e33beff8819191b5cfa5b4bde117",
      siteVersion: 16,
      scope: "V1.7-B minimum-design benchmark, enterprise grids and truthful review evidence",
      zipStatus: "Created",
    },
    {
      reviewRevision: "V1.7-A",
      sourceCommit: "e34d9f1ec10cfd14c91763b6bc5869f95566a09f",
      publishedAtUtc: "2026-09-12T04:40:09.602192Z",
      deploymentId: "appgdep_6aa4d79d6ebc819193a0aaaa8e03280c",
      siteVersion: 15,
      scope: "V1.7-A zero-click Sign-In and command-center acceptance correction",
      zipStatus: "Created",
    },
    {
      reviewRevision: "V1.6-FINAL",
      sourceCommit: "ef8dd7a531cdfaa3c642b552389d45044328866c",
      publishedAtUtc: "2026-09-12T04:04:36.950556Z",
      deploymentId: "appgdep_6aa4cf4928808191a7006ba55d936dd7",
      siteVersion: 14,
      scope: "V1.6 final deployment receipt and source-identity reconciliation",
      zipStatus: "Created",
    },
    {
      reviewRevision: "V1.6-FINAL",
      sourceCommit: "5727539c9770970ec2ed16281d53ba3f84487fd4",
      publishedAtUtc: "2026-09-12T04:00:38.369Z",
      deploymentId: "appgdep_6aa4ce5bbe408191b84317158f90488d",
      siteVersion: 13,
      scope: "V1.6 final design handoff, evidence, contracts and synchronized editable source",
      zipStatus: "Created",
    },
    {
      reviewRevision: "V1.6-D",
      sourceCommit: "0f1297ad9dfdeefb5527312c5d77a90c1537d2e7",
      publishedAtUtc: "2026-09-12T03:47:26.277Z",
      deploymentId: "appgdep_6aa4cb420bc88191afc530e1b717e749",
      siteVersion: 12,
      scope: "Sign-In acceptance, treasury depth, sync controls, market evidence and letterhead checkpoint",
      zipStatus: "Not created",
    },
    {
      reviewRevision: "V1.6-C",
      sourceCommit: "de0fd8725efffea44a636939f69a3f020da05e4d",
      publishedAtUtc: "2026-09-12T03:17:59.000Z",
      deploymentId: "appgdep_6aa4c459f1108191a48e4e36cb749348",
      siteVersion: 11,
      scope: "Treasury design boundary and retained V1.6-A/B foundations",
      zipStatus: "Not created",
    },
  ] satisfies PublicationRecord[],
} as const;

export function publishedAtEastern(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
    .format(new Date(value))
    .replace(/EDT|EST/, "ET");
}

export const farmConfiguration = {
  name: "Daenem Farms Ikire",
  clockLocationName: "Daenem Farms Ikire",
  timeZone: "Africa/Lagos",
  address:
    "Daenem Farms, No. 10 Saakin Road, KM 25 Ife–Ibadan Expressway, Opposite Entrance To Balogun Village, Ikire, Osun State, Nigeria",
};
