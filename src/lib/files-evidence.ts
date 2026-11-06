import { authorize, type AuthorizationSubject } from "./security-authority.ts";
import {
  ResourceWorkflowError,
  ResourceWorkflowService,
  type ResourceRecord,
  type ResourceRepository,
} from "./resource-workflow.ts";

export const EVIDENCE_RESOURCE_TYPE = "file-evidence";
export const EVIDENCE_MAX_BYTES = 32 * 1024 * 1024;
export const EVIDENCE_CONTENT_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
] as const);
export type EvidenceContentType = (typeof EVIDENCE_CONTENT_TYPES)[number];

export type EvidenceData = Readonly<{
  originalName: string;
  contentType: EvidenceContentType;
  sizeBytes: number;
  sha256: string;
  version: number;
  objectKey: string;
  uploadedAt: string;
}>;

export type EvidenceMetadata = Readonly<{
  id: string;
  subject: AuthorizationSubject;
  state: string;
  revision: number;
  originalName: string;
  contentType: EvidenceContentType;
  sizeBytes: number;
  sha256: string;
  version: number;
  uploadedAt: string;
}>;

export type EvidenceObject = Readonly<{
  body: Uint8Array | ReadableStream<Uint8Array>;
  contentType: EvidenceContentType;
  sizeBytes: number;
}>;

export interface EvidenceObjectStore {
  put(key: string, body: Uint8Array, contentType: EvidenceContentType): Promise<void>;
  get(key: string): Promise<EvidenceObject | null>;
  delete(key: string): Promise<void>;
}

export class EvidenceError extends Error {
  readonly code: "AUTHORIZATION_DENIED" | "NOT_FOUND" | "VALIDATION_FAILED" | "OBJECT_NOT_FOUND";
  constructor(code: EvidenceError["code"], message: string = code) {
    super(message);
    this.name = "EvidenceError";
    this.code = code;
  }
}

const evidenceDefinition = Object.freeze({
  resourceType: EVIDENCE_RESOURCE_TYPE,
  initialState: "active",
  permissions: {
    create: "files.create",
    edit: "files.edit",
    delete: "files.delete",
  },
  transitions: [],
  validate: (data: EvidenceData): readonly string[] => {
    const errors: string[] = [];
    if (!EVIDENCE_CONTENT_TYPES.includes(data.contentType)) errors.push("unsupported content type");
    if (data.sizeBytes < 1 || data.sizeBytes > EVIDENCE_MAX_BYTES) errors.push("size is outside the evidence limit");
    if (!/^[a-f0-9]{64}$/.test(data.sha256)) errors.push("sha256 is invalid");
    if (!Number.isInteger(data.version) || data.version < 1) errors.push("version is invalid");
    if (!data.objectKey.startsWith("evidence/")) errors.push("object key is invalid");
    return errors;
  },
});

function safeName(value: string) {
  const normalized = value.trim().replace(/[^A-Za-z0-9_. -]+/g, "_").slice(0, 120);
  return normalized || "evidence";
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(body: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", body as BufferSource);
  return hex(new Uint8Array(digest));
}

function metadata(record: ResourceRecord<EvidenceData>): EvidenceMetadata {
  return Object.freeze({
    id: record.id,
    subject: record.subject,
    state: record.state,
    revision: record.revision,
    originalName: record.data.originalName,
    contentType: record.data.contentType,
    sizeBytes: record.data.sizeBytes,
    sha256: record.data.sha256,
    version: record.data.version,
    uploadedAt: record.data.uploadedAt,
  });
}

function viewAllowed(principal: Parameters<typeof authorize>[0], subject: AuthorizationSubject) {
  return authorize(principal, {
    channel: "api",
    action: "view",
    permission: "files.view",
    subject,
  }).allowed;
}

/** R2-backed object store; the bucket binding never leaves this boundary. */
export class R2EvidenceObjectStore implements EvidenceObjectStore {
  private readonly bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  async put(key: string, body: Uint8Array, contentType: EvidenceContentType) {
    const result = await this.bucket.put(key, body as ArrayBufferView, {
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: { contentType },
    });
    if (!result) throw new Error("EVIDENCE_OBJECT_KEY_EXISTS");
  }

  async get(key: string) {
    const object = await this.bucket.get(key);
    if (!object) return null;
    const contentType = object.httpMetadata?.contentType;
    if (!EVIDENCE_CONTENT_TYPES.includes(contentType as EvidenceContentType)) return null;
    return {
      body: object.body,
      contentType: contentType as EvidenceContentType,
      sizeBytes: object.size,
    };
  }

  async delete(key: string) {
    await this.bucket.delete(key);
  }
}

export type EvidenceUploadIntent = Readonly<{
  reserve(objectKey: string, sha256: string, action: "create" | "edit"): Promise<void>;
  uploaded(objectKey: string): Promise<void>;
  reconcile(objectKey: string): Promise<string>;
}>;

export class FileEvidenceService {
  private readonly repository: ResourceRepository<EvidenceData>;
  private readonly resources: ResourceWorkflowService<EvidenceData>;
  private readonly objects: EvidenceObjectStore;
  private readonly now: () => string;
  private readonly intent?: EvidenceUploadIntent;

  constructor(
    repository: ResourceRepository<EvidenceData>,
    objects: EvidenceObjectStore,
    now: () => string = () => new Date().toISOString(),
    intent?: EvidenceUploadIntent,
  ) {
    this.repository = repository;
    this.resources = new ResourceWorkflowService(evidenceDefinition, repository, now);
    this.objects = objects;
    this.now = now;
    this.intent = intent;
  }

  async upload(
    principal: Parameters<typeof authorize>[0],
    input: Readonly<{
      id: string;
      subject: AuthorizationSubject;
      originalName: string;
      contentType: EvidenceContentType;
      body: Uint8Array;
      expectedSha256?: string;
    }>,
  ) {
    if (input.subject.resourceType !== EVIDENCE_RESOURCE_TYPE) {
      throw new EvidenceError("VALIDATION_FAILED", "evidence subject is invalid");
    }
    if (!EVIDENCE_CONTENT_TYPES.includes(input.contentType)) {
      throw new EvidenceError("VALIDATION_FAILED", "content type is not allowed");
    }
    if (input.body.byteLength < 1 || input.body.byteLength > EVIDENCE_MAX_BYTES) {
      throw new EvidenceError("VALIDATION_FAILED", "evidence size is not allowed");
    }
    const digest = await sha256(input.body);
    if (input.expectedSha256 && input.expectedSha256.toLowerCase() !== digest) {
      throw new EvidenceError("VALIDATION_FAILED", "checksum does not match");
    }

    const current = await this.repository.transaction((transaction) => transaction.get(input.id));
    const action = current ? "edit" : "create";
    const decision = authorize(principal, { channel: "api", action, permission: current ? "files.edit" : "files.create", subject: input.subject });
    if (!decision.allowed) throw new ResourceWorkflowError("AUTHORIZATION_DENIED", [decision.code]);
    const version = current ? current.data.version + 1 : 1;
    const objectKey = `evidence/${crypto.randomUUID()}`;
    const data: EvidenceData = {
      originalName: safeName(input.originalName),
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      sha256: digest,
      version,
      objectKey,
      uploadedAt: this.now(),
    };

    if (this.intent) await this.intent.reserve(objectKey, digest, current ? "edit" : "create");
    try {
      await this.objects.put(objectKey, input.body, input.contentType);
      if (this.intent) await this.intent.uploaded(objectKey);
      const record = current
        ? await this.resources.update(principal, {
            id: input.id,
            subject: input.subject,
            data,
            expectedRevision: current.revision,
          })
        : await this.resources.create(principal, {
            id: input.id,
            subject: input.subject,
            data,
          });
      return metadata(record);
    } catch (error) {
      // An ambiguous put or database response is never proof that deletion is safe.
      // Only the D1 intent protocol may claim an object for cleanup.
      if (this.intent) await this.intent.reconcile(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async metadata(
    principal: Parameters<typeof authorize>[0],
    id: string,
  ) {
    const record = await this.repository.transaction((transaction) => transaction.get(id));
    if (!record || !viewAllowed(principal, record.subject)) {
      throw new EvidenceError("NOT_FOUND");
    }
    return metadata(record);
  }

  async download(
    principal: Parameters<typeof authorize>[0],
    id: string,
  ) {
    const record = await this.repository.transaction((transaction) => transaction.get(id));
    if (!record || !viewAllowed(principal, record.subject)) {
      throw new EvidenceError("NOT_FOUND");
    }
    const object = await this.objects.get(record.data.objectKey);
    if (!object) throw new EvidenceError("OBJECT_NOT_FOUND");
    return { metadata: metadata(record), object };
  }

  async remove(principal: Parameters<typeof authorize>[0], id: string, expectedRevision: number) {
    const record = await this.repository.transaction((transaction) => transaction.get(id));
    if (!record) throw new EvidenceError("NOT_FOUND");
    try {
      const removed = await this.resources.remove(principal, { id, expectedRevision });
      await this.objects.delete(record.data.objectKey);
      return metadata(removed);
    } catch (error) {
      if (error instanceof ResourceWorkflowError && error.code === "AUTHORIZATION_DENIED") {
        throw new EvidenceError("AUTHORIZATION_DENIED");
      }
      throw error;
    }
  }
}
