"use client";

import {
  ArrowRight,
  Eye,
  MonitorCog,
  Settings2,
  ShieldCheck,
} from "lucide-react";

export function AdminExperienceHome({ go }: { go: (route: string) => void }) {
  return (
    <section className="admin-experience-home" aria-label="Admin design preview areas">
      <div className="admin-experience-intro">
        <span className="eyebrow">Owner Design Review · Sites Preview Only</span>
        <h2>Admin</h2>
        <p>
          Inspect presentation controls for the existing Sites experience. These
          workspaces do not authenticate a production user or change production systems.
        </p>
      </div>
      <div className="admin-experience-paths">
        <article>
          <span className="admin-experience-icon"><Settings2 aria-hidden="true" /></span>
          <small>Admin → Settings</small>
          <h3>Sign-In Experience / Sign-In Studio</h3>
          <p>Manage themes, backgrounds, clocks, weather, branding, widgets, drafts, previews, and preview-only publication.</p>
          <button type="button" onClick={() => go("settings")}>Open Sign-In Studio <ArrowRight aria-hidden="true" /></button>
        </article>
        <article>
          <span className="admin-experience-icon"><MonitorCog aria-hidden="true" /></span>
          <small>Admin → Experience Management</small>
          <h3>After-Sign-In Experience / After-Sign-In Studio</h3>
          <p>Open the reserved foundation for managing the current Sites after-login frontend in a future approved pass.</p>
          <button type="button" onClick={() => go("after-signin-studio")}>Open Foundation <ArrowRight aria-hidden="true" /></button>
        </article>
      </div>
      <aside className="admin-experience-boundary">
        <ShieldCheck aria-hidden="true" />
        <div><strong>Preview safety boundary</strong><p>Sample / design data only. No real RBAC grant, backend write, payment, payroll, security, or production action is available here.</p></div>
      </aside>
    </section>
  );
}

export function AfterSignInStudioFoundation({ go }: { go: (route: string) => void }) {
  return (
    <section className="after-signin-studio" aria-label="After-Sign-In Studio foundation">
      <div className="after-signin-studio-visual" aria-hidden="true">
        <span><MonitorCog /></span><i /><i /><i />
      </div>
      <div className="after-signin-studio-copy">
        <span className="eyebrow">Admin → Experience Management</span>
        <h2>After-Sign-In Experience / After-Sign-In Studio</h2>
        <p>
          This reserved workspace will manage the <strong>current Sites after-login frontend</strong>.
          It will not import or replace the production portal, and it is not a second dashboard.
        </p>
        <div className="after-signin-studio-status"><Eye aria-hidden="true" /><span><strong>Foundation ready for Owner review</strong><small>Management controls are intentionally deferred to a future approved frontend pass.</small></span></div>
        <button type="button" onClick={() => go("admin")}>Return To Admin</button>
      </div>
    </section>
  );
}
