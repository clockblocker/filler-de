import { expect } from "bun:test";
import type { PostHealingExpectations } from "./types";
import { fileExists, listFiles, readFile } from "./vault-ops";

const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 8_000;

/**
 * Retry `fn` until it doesn't throw or timeout is reached.
 * On timeout, rethrows the last error.
 */
async function pollUntilPass(
	fn: () => Promise<void>,
	timeoutMs = POLL_TIMEOUT_MS,
): Promise<void> {
	const start = Date.now();
	let lastError: unknown;
	while (Date.now() - start < timeoutMs) {
		try {
			await fn();
			return;
		} catch (e) {
			lastError = e;
			await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
		}
	}
	throw lastError;
}

/**
 * Assert that all given file paths exist in the vault (with polling).
 */
export async function expectFilesToExist(
	paths: readonly string[],
): Promise<void> {
	await pollUntilPass(async () => {
		const results = await Promise.all(
			paths.map(async (p) => ({ exists: await fileExists(p), path: p })),
		);
		const missing = results.filter((r) => !r.exists).map((r) => r.path);
		if (missing.length > 0) {
			const allFiles = await listFiles();
			throw new Error(
				`Missing ${missing.length} file(s):\n${missing.map((f) => `  - ${f}`).join("\n")}\n\nVault contains:\n${allFiles.join("\n")}`,
			);
		}
	});
}

/**
 * Assert that all given file paths do NOT exist in the vault (with polling).
 */
export async function expectFilesToBeGone(
	paths: readonly string[],
): Promise<void> {
	await pollUntilPass(async () => {
		const results = await Promise.all(
			paths.map(async (p) => ({ exists: await fileExists(p), path: p })),
		);
		const stillPresent = results
			.filter((r) => r.exists)
			.map((r) => r.path);
		expect(stillPresent).toEqual([]);
	});
}

/**
 * Assert that only the expected codex files exist (no orphans).
 * Codexes are files starting with `__-` under Library/.
 */
export async function expectExactCodexes(
	expectedCodexes: readonly string[],
	libraryRoot = "Library",
): Promise<void> {
	await pollUntilPass(async () => {
		const allFiles = await listFiles(libraryRoot, "md");
		const actualCodexes = allFiles.filter((f) => {
			const basename = f.split("/").pop() ?? "";
			return basename.startsWith("__-");
		});
		const sorted = (arr: readonly string[]) => [...arr].sort();
		expect(sorted(actualCodexes)).toEqual(sorted(expectedCodexes));
	});
}

/**
 * Assert content checks: each file must contain all expected lines.
 */
async function assertContentChecks(
	checks: readonly [string, readonly string[]][],
): Promise<void> {
	await pollUntilPass(async () => {
		const failures: string[] = [];
		for (const [path, expectedLines] of checks) {
			const content = await readFile(path);
			for (const line of expectedLines) {
				if (!content.includes(line)) {
					failures.push(`${path}: missing "${line}"`);
				}
			}
		}
		if (failures.length > 0) {
			throw new Error(
				`Content check failures:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
			);
		}
	});
}

/**
 * Assert negative content checks: each file must NOT contain any forbidden lines.
 */
async function assertNegativeContentChecks(
	checks: readonly [string, readonly string[]][],
): Promise<void> {
	await pollUntilPass(async () => {
		const failures: string[] = [];
		for (const [path, forbiddenLines] of checks) {
			const content = await readFile(path);
			for (const line of forbiddenLines) {
				if (content.includes(line)) {
					failures.push(`${path}: unexpectedly contains "${line}"`);
				}
			}
		}
		if (failures.length > 0) {
			throw new Error(
				`Negative content check failures:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
			);
		}
	});
}

/**
 * Full post-healing assertion: files exist, gone files gone,
 * content checks pass, negative content checks pass.
 */
export async function expectPostHealing(
	expectations: PostHealingExpectations,
): Promise<void> {
	await expectFilesToExist(expectations.codexes);
	await expectFilesToExist(expectations.files);

	if (expectations.goneFiles) {
		await expectFilesToBeGone(expectations.goneFiles);
	}

	if (expectations.contentChecks) {
		await assertContentChecks(expectations.contentChecks);
	}

	if (expectations.contentMustNotContain) {
		await assertNegativeContentChecks(expectations.contentMustNotContain);
	}
}
