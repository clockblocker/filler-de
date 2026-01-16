import { err, ok, type Result } from "neverthrow";
import { nonEmptyArrayResult } from "../../../../src/types/utils";
import { INTERVAL_DEFAULT_MS, TIMEOUT_DEFAULT_MS } from "../config";
import { E2ETestError, FilesExpectationError, FilesNotGoneError, finalizeE2EError } from "../internal/errors";
import { formatMissingFilesLong, formatMissingFilesShort, formatNotGoneFilesLong, formatNotGoneFilesShort } from "../internal/format";
import { obsidianCheckFolderChainAndListParent, obsidianFileExists, obsidianVaultSample } from "../internal/obsidian";
import { poll } from "../internal/poll";
import type { ExpectFilesGoneOptions, ExpectFilesOptions, FileWaitStatus, PollOptions } from "../internal/types";
import { readFile } from "./vault-ops";

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
  
    const shortMsg = formatMissingFilesShort(missing, opts.callerContext);
    const longMsg = await formatMissingFilesLong(missing, { callerContext: opts.callerContext, intervalMs, timeoutMs, logFolderOnFail: opts.logFolderOnFail });
  
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

  const shortMsg = formatNotGoneFilesShort(notGone, opts.callerContext);
  const longMsg = formatNotGoneFilesLong(notGone, { callerContext: opts.callerContext, intervalMs, timeoutMs });

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


/** Type for vault expectations with codexes and files */
export type PostHealingExpectations = {
	codexes: readonly string[];
	files: readonly string[];
	/** Optional content checks: [path, lines that must be present][] */
	contentChecks?: readonly [path: string, expectedLines: readonly string[]][];
};

/** Content check failure info */
export type ContentCheckFailure = {
	path: string;
	missingLines: readonly string[];
	actualContent: string;
};

/** Public: expect post-healing files (codexes + files) exist, then validate content */
export async function expectPostHealingFiles(
	expectations: PostHealingExpectations,
	opts: ExpectFilesOptions = {},
): Promise<void> {
	// First check all files exist
	await expectFilesToExist([...expectations.codexes, ...expectations.files], opts);

	// Then validate content if checks provided
	if (expectations.contentChecks && expectations.contentChecks.length > 0) {
		const failures: ContentCheckFailure[] = [];

		for (const [path, expectedLines] of expectations.contentChecks) {
			const contentResult = await readFile(path);
			if (contentResult.isErr()) {
				failures.push({
					path,
					missingLines: expectedLines,
					actualContent: `[read error: ${contentResult.error}]`,
				});
				continue;
			}

			const actualContent = contentResult.value;
			const missingLines = expectedLines.filter((line) => !actualContent.includes(line));

			if (missingLines.length > 0) {
				failures.push({ path, missingLines, actualContent });
			}
		}

		if (failures.length > 0) {
			const shortMsg = formatContentFailuresShort(failures, opts.callerContext);
			const longMsg = formatContentFailuresLong(failures, opts.callerContext);
			throw finalizeE2EError(new E2ETestError(shortMsg, longMsg));
		}
	}
}

function formatContentFailuresShort(failures: ContentCheckFailure[], callerContext?: string): string {
	const prefix = callerContext ? `${callerContext} ` : "";
	const paths = failures.map((f) => f.path).join(", ");
	return `${prefix}Content check failed for ${failures.length} file(s): ${paths}`;
}

function formatContentFailuresLong(failures: ContentCheckFailure[], callerContext?: string): string {
	const prefix = callerContext ? `${callerContext}\n` : "";
	const details = failures
		.map((f) => {
			const missing = f.missingLines.map((l) => `  - "${l}"`).join("\n");
			return `File: ${f.path}\nMissing lines:\n${missing}\nActual content:\n${f.actualContent}`;
		})
		.join("\n\n---\n\n");
	return `${prefix}Content validation failed:\n\n${details}`;
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
  