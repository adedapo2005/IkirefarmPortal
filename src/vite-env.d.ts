/// <reference types="vite/client" />

declare global {
  interface D1Meta {
    duration: number;
    size_after: number;
    rows_read: number;
    rows_written: number;
    last_row_id: number;
    changed_db: boolean;
    changes: number;
    [key: string]: any;
  }

  interface D1Response {
    success: boolean;
    meta: D1Meta;
    error?: string;
    changes?: number;
    results?: any[];
  }

  interface D1Result<T = unknown> {
    success: boolean;
    meta: D1Meta;
    results: T[];
    error?: string;
    changes?: number;
  }

  interface D1ExecResult {
    count: number;
    duration: number;
    changes?: number;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run<T = unknown>(): Promise<D1Result<T>>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>>;
    exec(query: string): Promise<D1ExecResult>;
  }

  interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    httpEtag: string;
    uploaded: Date;
    httpMetadata?: Record<string, any>;
    customMetadata?: Record<string, string>;
    writeHttpMetadata?: (headers: Headers) => void;
    body: any;
  }

  interface R2Bucket {
    head(key: string): Promise<R2Object | null>;
    get(key: string): Promise<R2Object | null>;
    put(key: string, value: unknown, options?: unknown): Promise<R2Object>;
    delete(keys: string | string[]): Promise<void>;
    list(options?: unknown): Promise<{ objects: R2Object[]; truncated: boolean; cursor?: string }>;
  }

  interface Ai {
    run(model: string, input: any): Promise<any>;
  }

  interface SendEmail {
    send(message: any): Promise<any>;
  }

  type PagesFunction<Env = Record<string, unknown>, P extends string = string, Data = Record<string, unknown>> = (
    context: {
      request: Request;
      functionPath: string;
      waitUntil: (promise: Promise<unknown>) => void;
      next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
      env: Env;
      params: Record<P, string | string[]>;
      data: Data;
    }
  ) => Response | Promise<Response>;
}

declare module 'cloudflare:workers' {
  export const env: any;
}

declare module '@/app/chatgpt-auth' {
  const chatgptAuth: any;
  export default chatgptAuth;
}

declare module '*.mjs' {
  const content: any;
  export default content;
}

export {};
