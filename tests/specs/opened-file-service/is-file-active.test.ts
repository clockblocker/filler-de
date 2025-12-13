/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type {
	OpenedFileServiceTestingApi,
	Result,
} from "./utils";

export const testIsFileActiveHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult, splitPath } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: File is active
		const activeFilePath = "is-active-test.md";
		try {
			await app.vault.create(activeFilePath, "# Active Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const activeFile = app.vault.getAbstractFileByPath(activeFilePath);
		if (!activeFile) throw new Error("Failed to create active file");
		await app.workspace.getLeaf(true).openFile(activeFile);

		// Get the actual splitPath from pwd to ensure exact match
		const pwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<{
			basename: string;
			pathParts: string[];
		}>;
		
		if (pwdResult.isErr()) {
			return {
				active: { error: pwdResult.error, success: false },
			};
		}

		const activeSplitPath = pwdResult.value;
		const activeResult = (await openedFileServiceWithResult.isFileActive(
			activeSplitPath,
		)) as unknown as Result<boolean>;

		if (activeResult.isErr()) {
			return {
				active: { error: activeResult.error, success: false },
			};
		}

		const activeTest = {
			isActive: activeResult.value,
			success: true,
		};

		// Test 2: Different file is active
		const differentFilePath = "is-active-different.md";
		try {
			await app.vault.create(differentFilePath, "# Different Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const differentFile = app.vault.getAbstractFileByPath(differentFilePath);
		if (!differentFile) throw new Error("Failed to create different file");
		await app.workspace.getLeaf(true).openFile(differentFile);

		const differentSplitPath = splitPath(activeFilePath); // Check against original file
		const differentResult = (await openedFileServiceWithResult.isFileActive(
			differentSplitPath,
		)) as unknown as Result<boolean>;

		if (differentResult.isErr()) {
			return {
				active: activeTest,
				different: { error: differentResult.error, success: false },
			};
		}

		const differentTest = {
			isActive: differentResult.value,
			success: true,
		};

		// Test 3: File path matches but different case (case-sensitive check)
		const caseFilePath = "is-active-case.md";
		try {
			await app.vault.create(caseFilePath, "# Case Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const caseFile = app.vault.getAbstractFileByPath(caseFilePath);
		if (!caseFile) throw new Error("Failed to create case file");
		await app.workspace.getLeaf(true).openFile(caseFile);

		// Try with different case in basename
		const caseSplitPath = splitPath("IS-ACTIVE-CASE.md");
		const caseResult = (await openedFileServiceWithResult.isFileActive(
			caseSplitPath,
		)) as unknown as Result<boolean>;

		if (caseResult.isErr()) {
			return {
				active: activeTest,
				case: { error: caseResult.error, success: false },
				different: differentTest,
			};
		}

		const caseTest = {
			isActive: caseResult.value,
			success: true,
		};

		return {
			active: activeTest,
			case: caseTest,
			different: differentTest,
		};
	});

	expect(results.active.success).toBe(true);
	expect(results.active.isActive).toBe(true);

	expect(results.different.success).toBe(true);
	expect(results.different.isActive).toBe(false);

	expect(results.case.success).toBe(true);
	// Case sensitivity: Obsidian paths are case-sensitive, so different case should return false
	expect(results.case.isActive).toBe(false);
};

export const testIsFileActiveErrorCases = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult, splitPath } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Close any open files by detaching all leaves
		const leaves = app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			await leaf.detach();
		}

		// Test: No file open
		const testFilePath = "is-active-no-file.md";
		const testSplitPath = splitPath(testFilePath);
		const noFileResult = (await openedFileServiceWithResult.isFileActive(
			testSplitPath,
		)) as unknown as Result<boolean>;

		return {
			noFile: {
				error: noFileResult.error,
				isErr: noFileResult.isErr(),
				success: noFileResult.isOk(),
			},
		};
	});

	expect(results.noFile.success).toBe(false);
	expect(results.noFile.isErr).toBe(true);
	expect(results.noFile.error).toBeDefined();
};
