const LAGOS_TIME_ZONE = "Africa/Lagos" as const;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

export const DAILY_FLOCK_IMPORT_PARSER_VERSION = "1.0.0" as const;

export type HistoricalFlockCandidateKind =
  | "placement"
  | "mortality"
  | "feed-consumed"
  | "medication-administered"
  | "vaccination"
  | "cull"
  | "transfer-in"
  | "transfer-out";

export type HistoricalFlockCandidateUnit =
  | "bird"
  | "kg"
  | "bag"
  | "tonne"
  | "ml"
  | "litre"
  | "dose"
  | "text";

export type HistoricalFlockSourceSpan = Readonly<{
  start: number;
  end: number;
  text: string;
}>;

export type HistoricalFlockAttribution = Readonly<{
  displayName: string | null;
  kind: "message-sender-text" | "unattributed-note";
  verifiedActor: false;
}>;

export type HistoricalFlockMessage = Readonly<{
  sourceHash: string;
  sourceSpan: HistoricalFlockSourceSpan;
  body: string;
  sentAtLocal: string | null;
  messageDate: string | null;
  reportDate: string | null;
  attribution: HistoricalFlockAttribution;
  reviewRequired: boolean;
  uncertaintyReasons: readonly string[];
}>;

export type HistoricalFlockCandidate = Readonly<{
  id: string;
  kind: HistoricalFlockCandidateKind;
  reportDate: string | null;
  value: number | string | null;
  unit: HistoricalFlockCandidateUnit;
  item: string | null;
  explicitNone: boolean;
  confidence: "high" | "medium" | "low";
  reviewRequired: boolean;
  autoApprovable: false;
  uncertaintyReasons: readonly string[];
  sourceMessageHash: string;
  sourceSpan: HistoricalFlockSourceSpan;
  normalizedKey: string;
  fingerprint: string;
  duplicateOf: string | null;
}>;

export type HistoricalFlockImportParseResult = Readonly<{
  parserVersion: typeof DAILY_FLOCK_IMPORT_PARSER_VERSION;
  timeZone: typeof LAGOS_TIME_ZONE;
  sourceHash: string;
  format: "whatsapp-export" | "pasted-note";
  messages: readonly HistoricalFlockMessage[];
  candidates: readonly HistoricalFlockCandidate[];
  warnings: readonly string[];
  requiresOperatorReview: true;
  canonicalWritesPerformed: false;
}>;

type Line = Readonly<{ start: number; end: number; text: string }>;

type MessageDraft = Readonly<{
  start: number;
  end: number;
  bodyStart: number;
  body: string;
  sender: string | null;
  messageDate: string | null;
  sentAtLocal: string | null;
}>;

type CandidateDraft = {
  kind: HistoricalFlockCandidateKind;
  reportDate: string | null;
  value: number | string | null;
  unit: HistoricalFlockCandidateUnit;
  item: string | null;
  explicitNone: boolean;
  confidence: "high" | "medium" | "low";
  reviewRequired: boolean;
  uncertaintyReasons: string[];
  sourceMessageHash: string;
  sourceSpan: HistoricalFlockSourceSpan;
  normalizedKey: string;
  fingerprint: string;
  id: string;
  duplicateOf: string | null;
};

const MONTHS: Readonly<Record<string, number>> = Object.freeze({
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
});

function splitLines(source: string): readonly Line[] {
  const lines: Line[] = [];
  let start = 0;
  while (start < source.length) {
    let cursor = start;
    while (cursor < source.length && source[cursor] !== "\n" && source[cursor] !== "\r") cursor += 1;
    const text = source.slice(start, cursor);
    if (source[cursor] === "\r" && source[cursor + 1] === "\n") cursor += 2;
    else if (cursor < source.length) cursor += 1;
    lines.push(Object.freeze({ start, end: cursor, text }));
    start = cursor;
  }
  if (source.length === 0) lines.push(Object.freeze({ start: 0, end: 0, text: "" }));
  return Object.freeze(lines);
}

function validLocalDate(year: number, month: number, day: number): string | null {
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month) || !Number.isSafeInteger(day)) return null;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseDateText(value: string): { date: string; twoDigitYear: boolean } | null {
  const clean = value.trim().replace(/[.,]$/, "");
  const numeric = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(clean);
  if (numeric) {
    const twoDigitYear = numeric[3].length === 2;
    const year = twoDigitYear ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const date = validLocalDate(year, Number(numeric[2]), Number(numeric[1]));
    return date ? { date, twoDigitYear } : null;
  }
  const textual = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{2}|\d{4})$/i.exec(clean);
  if (!textual) return null;
  const month = MONTHS[textual[2].toLowerCase()];
  if (!month) return null;
  const twoDigitYear = textual[3].length === 2;
  const year = twoDigitYear ? 2000 + Number(textual[3]) : Number(textual[3]);
  const date = validLocalDate(year, month, Number(textual[1]));
  return date ? { date, twoDigitYear } : null;
}

function previousLocalDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return validLocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())!;
}

function parseLocalTime(value: string): { hour: number; minute: number; second: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  const meridiem = match[4]?.toUpperCase();
  if (minute > 59 || second > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === "PM") hour += 12;
  } else if (hour > 23) return null;
  return { hour, minute, second };
}

function sentAtLocal(date: string, time: string): string | null {
  const parsed = parseLocalTime(time);
  if (!parsed) return null;
  return `${date}T${parsed.hour.toString().padStart(2, "0")}:${parsed.minute.toString().padStart(2, "0")}:${parsed.second.toString().padStart(2, "0")}+01:00`;
}

function parseWhatsAppHeader(line: string): Readonly<{
  date: string;
  time: string;
  sender: string;
  textOffset: number;
}> | null {
  const clean = line.replace(/^\uFEFF?\u200E?/, "");
  const patterns = [
    /^\[([^,\]]+),\s*([^\]]+)\]\s*([^:]{1,160}):\s?(.*)$/,
    /^([^,]{5,32}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s+-\s+([^:]{1,160}):\s?(.*)$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(clean);
    if (!match) continue;
    const parsedDate = parseDateText(match[1]);
    if (!parsedDate || !parseLocalTime(match[2])) continue;
    const text = match[4];
    return Object.freeze({
      date: parsedDate.date,
      time: match[2].trim(),
      sender: match[3].trim(),
      textOffset: line.length - text.length,
    });
  }
  return null;
}

function standaloneDate(line: string): string | null {
  const clean = line.trim().replace(/^(?:report\s+(?:for|date)|date)\s*[:\-]?\s*/i, "");
  return parseDateText(clean)?.date ?? null;
}

function messageDrafts(source: string): { format: "whatsapp-export" | "pasted-note"; drafts: readonly MessageDraft[] } {
  const lines = splitLines(source);
  const headers = lines.flatMap((line) => {
    const header = parseWhatsAppHeader(line.text);
    return header ? [{ line, header }] : [];
  });
  if (headers.length > 0) {
    const drafts = headers.map(({ line, header }, index): MessageDraft => {
      const end = headers[index + 1]?.line.start ?? source.length;
      const bodyStart = line.start + header.textOffset;
      return Object.freeze({
        start: line.start,
        end,
        bodyStart,
        body: source.slice(bodyStart, end).trimEnd(),
        sender: header.sender,
        messageDate: header.date,
        sentAtLocal: sentAtLocal(header.date, header.time),
      });
    });
    return { format: "whatsapp-export", drafts: Object.freeze(drafts) };
  }

  const headings = lines.flatMap((line) => {
    const date = standaloneDate(line.text);
    return date ? [{ line, date }] : [];
  });
  if (headings.length > 1) {
    return {
      format: "pasted-note",
      drafts: Object.freeze(headings.map(({ line, date }, index): MessageDraft => {
        const end = headings[index + 1]?.line.start ?? source.length;
        return Object.freeze({
          start: line.start,
          end,
          bodyStart: line.start,
          body: source.slice(line.start, end).trimEnd(),
          sender: null,
          messageDate: date,
          sentAtLocal: null,
        });
      })),
    };
  }

  return {
    format: "pasted-note",
    drafts: Object.freeze([Object.freeze({
      start: 0,
      end: source.length,
      bodyStart: 0,
      body: source.trimEnd(),
      sender: null,
      messageDate: headings[0]?.date ?? null,
      sentAtLocal: null,
    })]),
  };
}

function resolveReportDate(body: string, messageDate: string | null): Readonly<{
  date: string | null;
  reasons: readonly string[];
}> {
  const reasons: string[] = [];
  const labelledPattern = /(?:report\s+(?:for|date)|date)\s*[:\-]?\s*(\d{1,2}(?:st|nd|rd|th)?(?:[\/.\-]\d{1,2}[\/.\-]|\s+[a-z]+\s+)\d{2,4})/gi;
  const dates = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = labelledPattern.exec(body)) !== null) {
    const parsed = parseDateText(match[1]);
    if (parsed) {
      dates.add(parsed.date);
      if (parsed.twoDigitYear) reasons.push("The report date uses a two-digit year and must be confirmed.");
    }
  }
  const firstLineDate = standaloneDate(body.split(/\r?\n/, 1)[0] ?? "");
  if (firstLineDate) dates.add(firstLineDate);
  if (dates.size > 1) {
    reasons.push("The message contains conflicting report dates.");
    return Object.freeze({ date: null, reasons: Object.freeze(reasons) });
  }
  if (dates.size === 1) return Object.freeze({ date: [...dates][0], reasons: Object.freeze(reasons) });
  if (/\byesterday\b/i.test(body) && messageDate) {
    return Object.freeze({ date: previousLocalDate(messageDate), reasons: Object.freeze(reasons) });
  }
  if (/\byesterday\b/i.test(body) && !messageDate) reasons.push("'Yesterday' cannot be resolved without a message date.");
  return Object.freeze({ date: messageDate, reasons: Object.freeze(reasons) });
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").trim().replace(/\s+/g, " ");
}

function normalizedHashInput(value: string): string {
  return value.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function numericValue(token: string): number | null {
  const value = Number(token.replace(/,/g, ""));
  return Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function decimalValue(token: string): number | null {
  const value = Number(token.replace(/,/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function quantityUnit(value: string): HistoricalFlockCandidateUnit {
  const unit = value.toLowerCase();
  if (unit.startsWith("kg") || unit.startsWith("kilo")) return "kg";
  if (unit.startsWith("bag")) return "bag";
  if (unit.startsWith("ton")) return "tonne";
  if (unit === "ml" || unit.startsWith("millil")) return "ml";
  if (unit === "l" || unit.startsWith("lit")) return "litre";
  if (unit.startsWith("dose")) return "dose";
  return "text";
}

function addCandidate(
  target: CandidateDraft[],
  message: HistoricalFlockMessage,
  kind: HistoricalFlockCandidateKind,
  match: RegExpExecArray,
  bodyOffset: number,
  value: number | string | null,
  unit: HistoricalFlockCandidateUnit,
  options: Readonly<{
    item?: string | null;
    explicitNone?: boolean;
    confidence?: "high" | "medium" | "low";
    reasons?: readonly string[];
  }> = {},
): void {
  const reasons = [...message.uncertaintyReasons, ...(options.reasons ?? [])];
  const matchStart = bodyOffset + (match.index ?? 0);
  const sourceSpan = Object.freeze({ start: matchStart, end: matchStart + match[0].length, text: match[0] });
  const item = options.item?.trim() || null;
  const normalizedKey = [message.reportDate ?? "unknown-date", kind, String(value), unit, normalizedText(item ?? "")].join("|");
  target.push({
    kind,
    reportDate: message.reportDate,
    value,
    unit,
    item,
    explicitNone: options.explicitNone ?? false,
    confidence: options.confidence ?? (value === null ? "low" : "high"),
    reviewRequired: reasons.length > 0 || value === null || kind === "medication-administered" || kind === "vaccination" || unit === "bag",
    uncertaintyReasons: reasons,
    sourceMessageHash: message.sourceHash,
    sourceSpan,
    normalizedKey,
    fingerprint: "",
    id: "",
    duplicateOf: null,
  });
}

function collectCandidates(message: HistoricalFlockMessage, bodyOffset: number): CandidateDraft[] {
  const target: CandidateDraft[] = [];
  const body = message.body;
  const lines = splitLines(body);

  for (const bodyLine of lines) {
    const line = bodyLine.text;
    const absoluteOffset = bodyOffset + bodyLine.start;
    const explicitNonePatterns: readonly [HistoricalFlockCandidateKind, RegExp][] = [
      ["mortality", /\b(?:no\s+(?:birds?|chicks?)\s+(?:died|dead)|no\s+mortality|mortality\s*[:\-]?\s*(?:none|nil|zero))\b/i],
      ["medication-administered", /\b(?:no\s+(?:medication|medicine|treatment)|(?:medication|medicine|treatment)\s*[:\-]?\s*(?:none|nil))\b/i],
      ["vaccination", /\b(?:no\s+vaccination|vaccination\s*[:\-]?\s*(?:none|nil))\b/i],
    ];
    for (const [kind, pattern] of explicitNonePatterns) {
      const match = pattern.exec(line);
      if (match) addCandidate(target, message, kind, match, absoluteOffset, 0, kind === "mortality" ? "bird" : "text", { explicitNone: true });
    }

    const birdPatterns: readonly [HistoricalFlockCandidateKind, RegExp][] = [
      ["placement", /\b(?:placed|received|started\s+with)\s*[:\-]?\s*([\d,]+)\s*(?:birds?|chicks?|pullets?)\b/i],
      ["placement", /\b([\d,]+)\s*(?:birds?|chicks?|pullets?)\s+(?:placed|received|put\s+in)\b/i],
      ["mortality", /\b(?:mortality|dead\s+birds?|birds?\s+dead)\s*[:\-]?\s*([\d,]+)(?:\s*(?:or|\/|to)\s*([\d,]+))?\b/i],
      ["mortality", /\b([\d,]+)(?:\s*(?:or|\/|to)\s*([\d,]+))?\s*(?:birds?|chicks?)?\s*(?:died|dead)\b/i],
      ["cull", /\b(?:culled?|culls?)\s*[:\-]?\s*([\d,]+)\s*(?:birds?|chicks?)?\b/i],
      ["transfer-in", /\b(?:transfer(?:red)?\s+in|birds?\s+moved\s+in)\s*[:\-]?\s*([\d,]+)\s*(?:birds?|chicks?)?\b/i],
      ["transfer-out", /\b(?:transfer(?:red)?\s+out|birds?\s+moved\s+out)\s*[:\-]?\s*([\d,]+)\s*(?:birds?|chicks?)?\b/i],
    ];
    const seenKinds = new Set<HistoricalFlockCandidateKind>();
    for (const [kind, pattern] of birdPatterns) {
      if (seenKinds.has(kind)) continue;
      const match = pattern.exec(line);
      if (!match) continue;
      const ambiguous = Boolean(match[2]);
      const suffix = line.slice(match.index + match[0].length);
      const trailingUnit = /\d\s*$/.test(match[0]) ? /^\s*([a-z]+)/i.exec(suffix)?.[1]?.toLowerCase() : undefined;
      const unverifiedUnit = /^\.\d/.test(suffix) || Boolean(trailingUnit && !/^(birds?|chicks?|pullets?)$/.test(trailingUnit));
      const value = ambiguous || unverifiedUnit ? null : numericValue(match[1]);
      const reasons = ambiguous
        ? [`The ${kind.replace(/-/g, " ")} value contains more than one possible number.`]
        : unverifiedUnit ? ["The source does not establish a whole-number bird count."]
          : value === null ? [`The ${kind.replace(/-/g, " ")} value is outside the supported whole-number range.`] : [];
      addCandidate(target, message, kind, match, absoluteOffset, value, unverifiedUnit ? "text" : "bird", { reasons, confidence: reasons.length ? "low" : "high" });
      seenKinds.add(kind);
    }

    const feedPatterns = [
      /\bfeed\s*(?:used|consumed|given)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*(kg|kilograms?|bags?|tonnes?|tons?)\b/i,
      /\b(?:used|consumed|gave)\s+([\d,]+(?:\.\d+)?)\s*(kg|kilograms?|bags?|tonnes?|tons?)\s+(?:of\s+)?feed\b/i,
    ];
    let feedAdded = false;
    for (const pattern of feedPatterns) {
      const match = pattern.exec(line);
      if (!match) continue;
      const unit = quantityUnit(match[2]);
      const value = decimalValue(match[1]);
      const reasons = value === null ? ["The feed quantity is outside the supported numeric range."] : [];
      if (unit === "bag") reasons.push("Bag quantity must use the actual Inventory SKU weight before any kilogram conversion.");
      addCandidate(target, message, "feed-consumed", match, absoluteOffset, value, unit, { reasons, confidence: reasons.length ? "medium" : "high" });
      feedAdded = true;
      break;
    }
    if (!feedAdded) {
      const unsupportedFeed = /\bfeed\s*(?:used|consumed|given)?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*([a-z]+)\b/i.exec(line)
        ?? /\b(?:used|consumed|gave)\s+([\d,]+(?:\.\d+)?)\s*([a-z]+)\s+(?:of\s+)?feed\b/i.exec(line);
      if (unsupportedFeed) {
        addCandidate(target, message, "feed-consumed", unsupportedFeed, absoluteOffset, decimalValue(unsupportedFeed[1]), "text", {
          item: unsupportedFeed[2],
          confidence: "low",
          reasons: [`Feed unit '${unsupportedFeed[2]}' is not supported and must be corrected during review.`],
        });
      }
    }

    if (!/\b(?:none|nil|no\s+(?:medication|medicine|treatment))\b/i.test(line)) {
      const medication = /\b(?:medication|medicine|treatment|treated\s+with|administered|gave)\s*[:\-]?\s*([^;,.]{2,160})/i.exec(line);
      if (medication) {
        const detail = medication[1].trim();
        const dose = /^(.*?)([\d,]+(?:\.\d+)?)\s*(ml|millilitres?|l|litres?|doses?)\b/i.exec(detail);
        addCandidate(
          target,
          message,
          "medication-administered",
          medication,
          absoluteOffset,
          dose ? decimalValue(dose[2]) : detail,
          dose ? quantityUnit(dose[3]) : "text",
          { item: dose?.[1]?.trim() || detail, confidence: dose ? "medium" : "medium", reasons: ["Medication details require an authorized person to confirm the product and administration record."] },
        );
      }
    }

    if (!/\b(?:none|nil|no\s+vaccination)\b/i.test(line)) {
      const vaccination = /\b(?:vaccination|vaccine|vaccinated\s+with)\s*[:\-]?\s*([^;,.]{2,160})/i.exec(line);
      if (vaccination) {
        const detail = vaccination[1].trim();
        const dose = /^(.*?)([\d,]+(?:\.\d+)?)\s*(doses?)\b/i.exec(detail);
        addCandidate(
          target,
          message,
          "vaccination",
          vaccination,
          absoluteOffset,
          dose ? decimalValue(dose[2]) : detail,
          dose ? "dose" : "text",
          { item: dose?.[1]?.trim() || detail, confidence: "medium", reasons: ["Vaccination details require an authorized person to confirm the vaccine and administration record."] },
        );
      }
    }
  }
  return target;
}

function markConflicts(candidates: CandidateDraft[]): void {
  const groups = new Map<string, CandidateDraft[]>();
  for (const candidate of candidates) {
    const groupingItem = candidate.kind === "medication-administered" || candidate.kind === "vaccination"
      ? normalizedText(candidate.item ?? "")
      : "";
    const key = `${candidate.reportDate ?? "unknown-date"}|${candidate.kind}|${groupingItem}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  for (const group of groups.values()) {
    const distinct = new Set(group.map((candidate) => candidate.normalizedKey));
    if (distinct.size <= 1) continue;
    for (const candidate of group) {
      candidate.reviewRequired = true;
      candidate.confidence = "low";
      candidate.uncertaintyReasons.push("Different candidate values were found for the same report date and must be reconciled.");
    }
  }
}

export async function parseDailyFlockHistoricalText(source: string): Promise<HistoricalFlockImportParseResult> {
  if (typeof source !== "string") throw new TypeError("Historical daily flock source must be text");
  const byteLength = new TextEncoder().encode(source).byteLength;
  if (byteLength === 0) throw new RangeError("Historical daily flock source is empty");
  if (byteLength > MAX_SOURCE_BYTES) throw new RangeError("Historical daily flock source exceeds the 2 MiB parser limit");

  const parsed = messageDrafts(source);
  const sourceHash = await sha256(normalizedHashInput(source));
  const messages = await Promise.all(parsed.drafts.map(async (draft): Promise<HistoricalFlockMessage> => {
    const date = resolveReportDate(draft.body, draft.messageDate);
    const span = Object.freeze({ start: draft.start, end: draft.end, text: source.slice(draft.start, draft.end) });
    const reasons = [...date.reasons];
    if (!date.date) reasons.push("No unambiguous Africa/Lagos report date was found.");
    return Object.freeze({
      sourceHash: await sha256(normalizedHashInput(span.text)),
      sourceSpan: span,
      body: draft.body,
      sentAtLocal: draft.sentAtLocal,
      messageDate: draft.messageDate,
      reportDate: date.date,
      attribution: Object.freeze({
        displayName: draft.sender,
        kind: draft.sender ? "message-sender-text" : "unattributed-note",
        verifiedActor: false,
      }),
      reviewRequired: reasons.length > 0,
      uncertaintyReasons: Object.freeze(reasons),
    });
  }));

  const drafts = messages.flatMap((message, index) => collectCandidates(message, parsed.drafts[index].bodyStart));
  await Promise.all(drafts.map(async (candidate) => {
    candidate.fingerprint = await sha256(candidate.normalizedKey);
    const occurrenceHash = await sha256([
      candidate.fingerprint,
      candidate.sourceMessageHash,
      candidate.sourceSpan.start,
      candidate.sourceSpan.end,
    ].join("|"));
    candidate.id = `flock-import-candidate-${occurrenceHash.slice(0, 20)}`;
  }));
  markConflicts(drafts);
  const firstByFingerprint = new Map<string, string>();
  for (const candidate of drafts) {
    const first = firstByFingerprint.get(candidate.fingerprint);
    if (first) candidate.duplicateOf = first;
    else firstByFingerprint.set(candidate.fingerprint, candidate.id);
  }

  const warnings: string[] = [];
  if (drafts.length === 0) warnings.push("No supported daily flock values were recognized; do not treat missing fields as zero.");
  if (messages.some((message) => !message.reportDate)) warnings.push("One or more messages need a report date before review can be completed.");
  if (drafts.some((candidate) => candidate.unit === "bag")) warnings.push("Bag quantities remain in bags until an authorized Inventory SKU weight is resolved.");
  if (drafts.some((candidate) => candidate.duplicateOf)) warnings.push("Duplicate normalized candidates were detected and must not be posted twice.");

  const candidates = drafts.map((candidate): HistoricalFlockCandidate => Object.freeze({
    ...candidate,
    autoApprovable: false,
    uncertaintyReasons: Object.freeze([...candidate.uncertaintyReasons]),
  }));
  return Object.freeze({
    parserVersion: DAILY_FLOCK_IMPORT_PARSER_VERSION,
    timeZone: LAGOS_TIME_ZONE,
    sourceHash,
    format: parsed.format,
    messages: Object.freeze(messages),
    candidates: Object.freeze(candidates),
    warnings: Object.freeze(warnings),
    requiresOperatorReview: true,
    canonicalWritesPerformed: false,
  });
}
