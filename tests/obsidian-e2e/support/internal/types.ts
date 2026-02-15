export interface PollOptions {
    timeoutOffset?: number;
    intervalOffset?: number;
  
    /** Optional hard override if you want to bypass defaults+offsets */
    timeoutMs?: number;
    intervalMs?: number;
    maxAttempts?: number;
  
    /** Used for error messages */
    label?: string;
  }
  
  export type PollResult<T> =
    | {
        ok: true;
        value: T;
        attempts: number;
        waitedMs: number;
        timeoutMs: number;
        intervalMs: number;
        label?: string;
      }
    | {
        ok: false;
        value?: T;
        attempts: number;
        waitedMs: number;
        timeoutMs: number;
        intervalMs: number;
        label?: string;
      };
  
  export type FileWaitStatus =
    | { path: string; ok: true; firstSeenAtMs: number; attempts: number }
    | {
        path: string;
        ok: false;
        attempts: number;
        waitedMs: number;
  
        /** evidence */
        finalObsidianSeesFile: boolean;
        vaultSample?: string[];
        folderChainCheck?: { missingFolder?: string; parentFolderContents?: string };
      };
  
  export type ExpectFilesOptions = PollOptions & {
    includeVaultSample?: boolean;
    vaultSampleLimit?: number;
    /** Optional caller context to include in error messages (e.g., "[testAllFilesSuffixedOnInit]") */
    callerContext?: string;
    /** Optional folder path to log to file on failure */
    logFolderOnFail?: string;
  };

  export type ExpectFilesGoneOptions = PollOptions & {
    includeVaultSample?: boolean;
    vaultSampleLimit?: number;
    /** Optional caller context to include in error messages (e.g., "[testAllFilesSuffixedOnInit]") */
    callerContext?: string;
  };