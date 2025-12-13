/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type {
	OpenedFileServiceTestingApi,
	Result,
	SplitPathToMdFile,
} from "./utils";

export const testPwdHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: File in root folder
		const rootFilePath = "root-test.md";
		try {
			await app.vault.create(rootFilePath, "# Root Test");
		} catch (e) {
			// File might already exist from previous test run
			if (!e.message?.includes("already exists")) throw e;
		}
		const rootFile = app.vault.getAbstractFileByPath(rootFilePath);
		if (!rootFile) throw new Error("Failed to create root file");
		await app.workspace.getLeaf(true).openFile(rootFile);

		const rootPwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<
			SplitPathToMdFile
		>;

		if (rootPwdResult.isErr()) {
			return {
				root: { error: rootPwdResult.error, success: false },
			};
		}

		const rootResult = {
			basename: rootPwdResult.value?.basename,
			pathParts: rootPwdResult.value?.pathParts,
			success: true,
		};

		// Test 2: File in nested folder
		const nestedFolderPath = "nested/folder";
		try {
			await app.vault.createFolder(nestedFolderPath);
		} catch (e) {
			// Folder might already exist
			if (!e.message?.includes("already exists")) throw e;
		}
		const nestedFilePath = "nested/folder/nested-test.md";
		try {
			await app.vault.create(nestedFilePath, "# Nested Test");
		} catch (e) {
			// File might already exist
			if (!e.message?.includes("already exists")) throw e;
		}
		const nestedFile = app.vault.getAbstractFileByPath(nestedFilePath);
		if (!nestedFile) throw new Error("Failed to create nested file");
		await app.workspace.getLeaf(true).openFile(nestedFile);

		const nestedPwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<
			SplitPathToMdFile
		>;

		if (nestedPwdResult.isErr()) {
			return {
				nested: { error: nestedPwdResult.error, success: false },
				root: rootResult,
			};
		}

		const nestedResult = {
			basename: nestedPwdResult.value?.basename,
			pathParts: nestedPwdResult.value?.pathParts,
			success: true,
		};

		return { nested: nestedResult, root: rootResult };
	});

	expect(results.root.success).toBe(true);
	expect(results.root.basename).toBe("root-test");
	expect(results.root.pathParts).toEqual([]);

	expect(results.nested.success).toBe(true);
	expect(results.nested.basename).toBe("nested-test");
	expect(results.nested.pathParts).toEqual(["nested", "folder"]);
};

export const testPwdErrorCases = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Close any open files by detaching all leaves
		const leaves = app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			await leaf.detach();
		}

		// Test: No file open
		const noFileResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<
			SplitPathToMdFile
		>;

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
