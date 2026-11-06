"use client";

import PortalExperience from "./PortalExperience";

/**
 * Synthetic personas are available only below the server-gated /review tree.
 * This component is never imported by the normal application entry.
 */
export default function ReviewPortalEntry() {
  return <PortalExperience initialRoute="signin" reviewMode />;
}
