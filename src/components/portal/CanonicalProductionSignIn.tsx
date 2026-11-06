"use client";

import { useEffect, useMemo, useState } from "react";

const CANONICAL_PATH = "/approved-signin/";

export default function CanonicalProductionSignIn() {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const source = new URLSearchParams(window.location.search);
    const allowed = new URLSearchParams();
    for (const key of ["auth", "invite", "token", "guarantor", "mode", "motion", "background", "presentation", "theme"]) {
      const value = source.get(key);
      if (value) allowed.set(key, value);
    }
    setSearch(allowed.toString());
  }, []);

  const source = useMemo(
    () => `${CANONICAL_PATH}${search ? `?${search}` : ""}`,
    [search],
  );

  return (
    <main id="main-content" className="canonical-signin-frame-shell">
      <iframe
        className="canonical-signin-frame"
        src={source}
        title="Daenem Farms employee portal sign in"
        allow="clipboard-write"
      />
    </main>
  );
}
