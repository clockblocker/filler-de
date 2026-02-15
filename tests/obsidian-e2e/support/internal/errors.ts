import type { FileWaitStatus } from "./types";

export class E2ETestError extends Error {
    /** Optional long diagnostic text (not in `message`) */
    details?: string;
  
    constructor(message: string, details?: string) {
      super(message);
      this.name = this.constructor.name;
      this.details = details;
    }
  }
  
  /** Trim stacks to reduce WDIO noise (opt-in verbose via env) */
  export function finalizeE2EError(err: Error): Error {
    const debug = process.env.E2E_DEBUG === "1";
  
    if (!debug && err.stack) {
      // Remove stack trace, keep only the error message
      const lines = err.stack.split("\n");
      err.stack = lines[0];
    }
  
    return err;
  }
  
export class FilesExpectationError extends E2ETestError {
  readonly missing: Extract<FileWaitStatus, { ok: false }>[];
  constructor(message: string, missing: Extract<FileWaitStatus, { ok: false }>[]) {
    super(message);
    this.name = "FilesExpectationError";
    this.missing = missing;
  }
}

export class FilesNotGoneError extends E2ETestError {
  readonly notGone: Array<{ path: string; waitedMs: number; attempts: number; finalObsidianSeesFile: boolean; vaultSample?: string[] }>;
  constructor(message: string, notGone: Array<{ path: string; waitedMs: number; attempts: number; finalObsidianSeesFile: boolean; vaultSample?: string[] }>) {
    super(message);
    this.name = "FilesNotGoneError";
    this.notGone = notGone;
  }
}