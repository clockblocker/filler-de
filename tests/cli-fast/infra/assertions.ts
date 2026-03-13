import { expect } from "bun:test";
import {
	exactPathExists,
	listExactFiles,
	readExactFile,
} from "./vault";

const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 5_000;

export type FastExpectations = {
	exactCodexes?: {
		folder: string;
		paths: readonly string[];
	};
	files?: readonly string[];
	folderSnapshot?: {
		exactCodexes?: readonly string[];
		files?: readonly string[];
		folder: string;
		goneFiles?: readonly string[];
	};
	goneFiles?: readonly string[];
	contentChecks?: readonly [path: string, expectedFragments: readonly string[]][];
	contentMustNotContain?: readonly [path: string, forbiddenFragments: readonly string[]][];
};

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
		} catch (error) {
			lastError = error;
			await Bun.sleep(POLL_INTERVAL_MS);
		}
	}

	throw lastError;
}

export async function expectExactFiles(paths: readonly string[]): Promise<void> {
	await pollUntilPass(async () => {
		const results = await Promise.all(
			paths.map(async (path) => ({
				exists: await exactPathExists(path),
				path,
			})),
		);
		const missing = results.filter((result) => !result.exists).map((result) => result.path);
		if (missing.length === 0) {
			return;
		}

		const allFiles = await listExactFiles();
		throw new Error(
			`Missing ${missing.length} file(s):\n${missing.map((path) => `  - ${path}`).join("\n")}\n\nVault contains:\n${allFiles.join("\n")}`,
		);
	});
}

export async function expectExactCodexes(params: {
	folder: string;
	paths: readonly string[];
}): Promise<void> {
	await pollUntilPass(async () => {
		const allFiles = await listExactFiles(params.folder);
		const actualCodexes = allFiles.filter((path) => {
			const basename = path.split("/").pop() ?? "";
			return basename.startsWith("__-");
		});
		expect([...actualCodexes].sort()).toEqual([...params.paths].sort());
	});
}

export async function expectFolderSnapshot(params: {
	exactCodexes?: readonly string[];
	files?: readonly string[];
	folder: string;
	goneFiles?: readonly string[];
}): Promise<void> {
	await pollUntilPass(async () => {
		const allFiles = await listExactFiles(params.folder);
		const allFilesSet = new Set(allFiles);

		if (params.files) {
			const missing = params.files.filter((path) => !allFilesSet.has(path));
			if (missing.length > 0) {
				throw new Error(
					`Missing ${missing.length} file(s):\n${missing.map((path) => `  - ${path}`).join("\n")}\n\nFolder contains:\n${allFiles.join("\n")}`,
				);
			}
		}

		if (params.goneFiles) {
			const stillPresent = params.goneFiles.filter((path) => allFilesSet.has(path));
			if (stillPresent.length > 0) {
				throw new Error(
					`Still present ${stillPresent.length} file(s):\n${stillPresent.map((path) => `  - ${path}`).join("\n")}\n\nFolder contains:\n${allFiles.join("\n")}`,
				);
			}
		}

		if (params.exactCodexes) {
			const actualCodexes = allFiles.filter((path) => {
				const basename = path.split("/").pop() ?? "";
				return basename.startsWith("__-");
			});
			expect([...actualCodexes].sort()).toEqual([...params.exactCodexes].sort());
		}
	});
}

export async function expectExactGoneFiles(
	paths: readonly string[],
): Promise<void> {
	await pollUntilPass(async () => {
		const results = await Promise.all(
			paths.map(async (path) => ({
				exists: await exactPathExists(path),
				path,
			})),
		);
		const stillPresent = results
			.filter((result) => result.exists)
			.map((result) => result.path);
		expect(stillPresent).toEqual([]);
	});
}

async function assertContentChecks(
	checks: readonly [string, readonly string[]][],
): Promise<void> {
	await pollUntilPass(async () => {
		const failures: string[] = [];
		for (const [path, fragments] of checks) {
			const content = await readExactFile(path);
			for (const fragment of fragments) {
				if (!content.includes(fragment)) {
					failures.push(`${path}: missing "${fragment}"`);
				}
			}
		}
		if (failures.length > 0) {
			throw new Error(failures.join("\n"));
		}
	});
}

async function assertNegativeContentChecks(
	checks: readonly [string, readonly string[]][],
): Promise<void> {
	await pollUntilPass(async () => {
		const failures: string[] = [];
		for (const [path, fragments] of checks) {
			const content = await readExactFile(path);
			for (const fragment of fragments) {
				if (content.includes(fragment)) {
					failures.push(`${path}: unexpectedly contains "${fragment}"`);
				}
			}
		}
		if (failures.length > 0) {
			throw new Error(failures.join("\n"));
		}
	});
}

export async function expectFastHealing(
	expectations: FastExpectations,
): Promise<void> {
	if (expectations.folderSnapshot) {
		await expectFolderSnapshot(expectations.folderSnapshot);
	}

	if (expectations.exactCodexes) {
		await expectExactCodexes(expectations.exactCodexes);
	}

	if (expectations.files) {
		await expectExactFiles(expectations.files);
	}

	if (expectations.goneFiles) {
		await expectExactGoneFiles(expectations.goneFiles);
	}

	if (expectations.contentChecks) {
		await assertContentChecks(expectations.contentChecks);
	}

	if (expectations.contentMustNotContain) {
		await assertNegativeContentChecks(expectations.contentMustNotContain);
	}
}
