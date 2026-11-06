"use client";

import CanonicalProductionSignIn from "./CanonicalProductionSignIn";

/**
 * Public entry is intentionally only the public Sign-In. Authenticated access
 * is granted by AppEntry after the server-backed session check; no browser
 * storage flag, URL value, hash, or message can enter the workspace.
 */
export default function PublicEntry() {
  return <CanonicalProductionSignIn />;
}
