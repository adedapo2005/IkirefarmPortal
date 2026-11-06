type InsightRow = {
  resource_type: string;
  state: string;
  count: number;
  latest: string | null;
};

export type OperationsInsight = {
  id: string;
  label: string;
  title: string;
  message: string;
  metric: number;
  updatedAt: string | null;
};

const TYPES = ["flock", "feed", "egg-batch", "health-event", "vaccination"] as const;

function sum(rows: InsightRow[], type: string, states?: string[]) {
  return rows
    .filter((row) => row.resource_type === type && (!states || states.includes(row.state)))
    .reduce((total, row) => total + Number(row.count || 0), 0);
}

function latest(rows: InsightRow[], type: string) {
  return rows
    .filter((row) => row.resource_type === type && row.latest)
    .map((row) => row.latest as string)
    .sort()
    .at(-1) || null;
}

export async function getOperationsInsights(db: D1Database) {
  const placeholders = TYPES.map(() => "?").join(",");
  const result = await db.prepare(
    `SELECT resource_type, state, COUNT(*) AS count, MAX(updated_at) AS latest
     FROM resource_records
     WHERE deleted_at IS NULL AND resource_type IN (${placeholders})
     GROUP BY resource_type, state
     ORDER BY resource_type, state`,
  ).bind(...TYPES).all<InsightRow>();
  const rows = result.results || [];
  const records = rows.reduce((total, row) => total + Number(row.count || 0), 0);
  const activeFlocks = sum(rows, "flock", ["active"]);
  const openHealth = sum(rows, "health-event", ["open"]);
  const verifiedEggBatches = sum(rows, "egg-batch", ["verified"]);
  const plannedVaccinations = sum(rows, "vaccination", ["planned"]);
  const postedFeed = sum(rows, "feed", ["posted"]);

  const items: OperationsInsight[] = records ? [
    {
      id: "active-flocks",
      label: "Flock activity",
      title: `${activeFlocks} active flock${activeFlocks === 1 ? "" : "s"}`,
      message: activeFlocks ? "Current flock records are active and reporting." : "No active flock record requires public attention.",
      metric: activeFlocks,
      updatedAt: latest(rows, "flock"),
    },
    {
      id: "health-events",
      label: "Health watch",
      title: openHealth ? `${openHealth} open health event${openHealth === 1 ? "" : "s"}` : "No open health events",
      message: openHealth ? "Open events remain visible to authorized farm teams." : "Recorded health events have no open public aggregate.",
      metric: openHealth,
      updatedAt: latest(rows, "health-event"),
    },
    {
      id: "production",
      label: "Production",
      title: `${verifiedEggBatches} verified egg batch${verifiedEggBatches === 1 ? "" : "es"}`,
      message: "Verified batches are counted from canonical FarmPortal records.",
      metric: verifiedEggBatches,
      updatedAt: latest(rows, "egg-batch"),
    },
    {
      id: "vaccinations",
      label: "Vaccination plan",
      title: plannedVaccinations ? `${plannedVaccinations} vaccination${plannedVaccinations === 1 ? "" : "s"} planned` : "No vaccinations currently planned",
      message: "The summary excludes animal, employee and location identifiers.",
      metric: plannedVaccinations,
      updatedAt: latest(rows, "vaccination"),
    },
    {
      id: "feed",
      label: "Feed operations",
      title: `${postedFeed} posted feed record${postedFeed === 1 ? "" : "s"}`,
      message: "Only approved aggregate operational activity is shown.",
      metric: postedFeed,
      updatedAt: latest(rows, "feed"),
    },
  ] : [];

  return {
    state: records ? "available" : "empty",
    source: "FarmPortal canonical operational records",
    refreshSeconds: 300,
    rotationSeconds: 20,
    generatedAt: new Date().toISOString(),
    items,
  };
}
