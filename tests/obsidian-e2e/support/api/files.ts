import { err, ok, type Result } from "neverthrow";
import { nonEmptyArrayResult } from "../../../../src/types/utils";
import { INTERVAL_DEFAULT_MS, TIMEOUT_DEFAULT_MS } from "../config";
import { E2ETestError, FilesExpectationError, FilesNotGoneError, finalizeE2EError } from "../internal/errors";
import { formatMissingFilesLong, formatMissingFilesShort, formatNotGoneFilesLong, formatNotGoneFilesShort } from "../internal/format";
import { obsidianCheckFolderChainAndListParent, obsidianFileExists, obsidianVaultSample } from "../internal/obsidian";
import { poll } from "../internal/poll";
import type { ExpectFilesGoneOptions, ExpectFilesOptions, FileWaitStatus, PollOptions } from "../internal/types";

/** Public: wait until a file exists */
export async function waitForFile(path: string, opts: PollOptions = {}): Promise<boolean> {
  const res = await poll(
    () => obsidianFileExists(path),
    (v) => v === true,
    { ...opts, label: opts.label ?? `waitForFile(${path})` },
  );
  return res.ok;
}

/** Public: wait until a file is gone */
export async function waitForFileGone(path: string, opts: PollOptions = {}): Promise<boolean> {
  const res = await poll(
    () => obsidianFileExists(path),
    (v) => v === false,
    { ...opts, label: opts.label ?? `waitForFileGone(${path})` },
  );
  return res.ok;
}

/** Public: wait for many files (boolean-only) */
export async function waitForFiles(
  paths: readonly string[],
  opts: PollOptions = {},
): Promise<boolean[]> {
  return Promise.all(paths.map((p) => waitForFile(p, opts)));
}

/** Internal: expect files exist; returns Result */
async function expectFilesToExistResult(
    paths: readonly string[],
    opts: ExpectFilesOptions = {},
  ): Promise<Result<void, E2ETestError>> {
    const results = await Promise.all(paths.map((p) => waitForFileDetailed(p, opts)));
    const missingResult = nonEmptyArrayResult(results.filter((r) => !r.ok));
  
    if (missingResult.isErr()) return ok(undefined);
    const missing = missingResult.value;
  
    const timeoutMs = opts.timeoutMs ?? (TIMEOUT_DEFAULT_MS + (opts.timeoutOffset ?? 0));
    const intervalMs = opts.intervalMs ?? (INTERVAL_DEFAULT_MS + (opts.intervalOffset ?? 0));
  
    const shortMsg = formatMissingFilesShort(missing);
    const longMsg = formatMissingFilesLong(missing, { intervalMs, timeoutMs });
  
    const error = finalizeE2EError(new E2ETestError(shortMsg, longMsg));
    return err(error);
  }
  
/** Internal: expect files are gone; returns Result */
async function expectFilesToBeGoneResult(
  paths: readonly string[],
  opts: ExpectFilesGoneOptions = {},
): Promise<Result<void, E2ETestError>> {
  const results = await Promise.all(paths.map((p) => waitForFileGoneDetailed(p, opts)));
  const notGone = results.filter((r) => !r.ok);

  if (notGone.length === 0) {
    return ok(undefined);
  }

  const timeoutMs = opts.timeoutMs ?? (TIMEOUT_DEFAULT_MS + (opts.timeoutOffset ?? 0));
  const intervalMs = opts.intervalMs ?? (INTERVAL_DEFAULT_MS + (opts.intervalOffset ?? 0));

  const shortMsg = formatNotGoneFilesShort(notGone);
  const longMsg = formatNotGoneFilesLong(notGone, { intervalMs, timeoutMs });

  const error = finalizeE2EError(new E2ETestError(shortMsg, longMsg));
  return err(error);
}

/** Public: expect files exist; throws on error for test assertions */
export async function expectFilesToExist(
    paths: readonly string[],
    opts: ExpectFilesOptions = {},
  ): Promise<void> {
  const result = await expectFilesToExistResult(paths, opts);
  if (result.isErr()) {
    throw result.error;
  }
}

/** Public: expect files are gone; throws on error for test assertions */
export async function expectFilesToBeGone(
  paths: readonly string[],
  opts: ExpectFilesGoneOptions = {},
): Promise<void> {
  const result = await expectFilesToBeGoneResult(paths, opts);
  if (result.isErr()) {
    throw result.error;
  }
}


/** Internal helper: detailed per-file wait status */
async function waitForFileDetailed(
    path: string,
    opts: ExpectFilesOptions = {},
  ): Promise<FileWaitStatus> {
    const res = await poll(
      () => obsidianFileExists(path),
      (v) => v === true,
      { ...opts, label: opts.label ?? `waitForFileDetailed(${path})` },
    );
  
    if (res.ok) {
      return { attempts: res.attempts, firstSeenAtMs: res.waitedMs, ok: true, path };
    }
  
    // Reuse poll result value if available, otherwise re-check
    const finalObsidianSeesFile = res.value ?? (await obsidianFileExists(path));
  
    let vaultSample: string[] | undefined;
    if (opts.includeVaultSample) {
      vaultSample = await obsidianVaultSample(opts.vaultSampleLimit ?? 50);
    }

    const folderChainCheck = await obsidianCheckFolderChainAndListParent(path);
  
    return {
      attempts: res.attempts,
      finalObsidianSeesFile,
      folderChainCheck,
      ok: false,
      path,
      vaultSample,
      waitedMs: res.waitedMs,
    };
  }


/** Internal helper: detailed per-file wait status for "gone" check */
async function waitForFileGoneDetailed(
    path: string,
    opts: ExpectFilesGoneOptions = {},
  ): Promise<{ path: string; ok: boolean; attempts: number; waitedMs: number; finalObsidianSeesFile: boolean; vaultSample?: string[] }> {
    const res = await poll(
      () => obsidianFileExists(path),
      (v) => v === false,
      { ...opts, label: opts.label ?? `waitForFileGoneDetailed(${path})` },
    );
  
    if (res.ok) {
      return { attempts: res.attempts, finalObsidianSeesFile: false, ok: true, path, waitedMs: res.waitedMs };
    }
  
    // Reuse poll result value if available, otherwise re-check
    const finalObsidianSeesFile = res.value ?? (await obsidianFileExists(path));
  
    let vaultSample: string[] | undefined;
    if (opts.includeVaultSample) {
      vaultSample = await obsidianVaultSample(opts.vaultSampleLimit ?? 50);
    }
  
    return {
      attempts: res.attempts,
      finalObsidianSeesFile,
      ok: false,
      path,
      vaultSample,
      waitedMs: res.waitedMs,
    };
  }
  