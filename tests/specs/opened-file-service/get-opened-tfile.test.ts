/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type {
	OpenedFileServiceTestingApi,
	Result,
} from "./utils";

export const testGetOpenedTFileHappyPath = async () => {
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
		const rootFilePath = "get-tfile-root.md";
		try {
			await app.vault.create(rootFilePath, "# Root Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const rootFile = app.vault.getAbstractFileByPath(rootFilePath);
		if (!rootFile) throw new Error("Failed to create root file");
		await app.workspace.getLeaf(true).openFile(rootFile);

		const rootResult = (await openedFileServiceWithResult.getOpenedTFile()) as unknown as Result<{
			name: string;
			path: string;
			extension: string;
		}>;

		if (rootResult.isErr()) {
			return {
				root: { error: rootResult.error, success: false },
			};
		}

		const rootTest = {
			extension: rootResult.value?.extension,
			name: rootResult.value?.name,
			path: rootResult.value?.path,
			success: true,
		};

		// Test 2: File in nested folder
		const nestedFolderPath = "get-tfile-nested/folder";
		try {
			await app.vault.createFolder(nestedFolderPath);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const nestedFilePath = "get-tfile-nested/folder/nested.md";
		try {
			await app.vault.create(nestedFilePath, "# Nested Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const nestedFile = app.vault.getAbstractFileByPath(nestedFilePath);
		if (!nestedFile) throw new Error("Failed to create nested file");
		await app.workspace.getLeaf(true).openFile(nestedFile);

		const nestedResult = (await openedFileServiceWithResult.getOpenedTFile()) as unknown as Result<{
			name: string;
			path: string;
			extension: string;
		}>;

		if (nestedResult.isErr()) {
			return {
				nested: { error: nestedResult.error, success: false },
				root: rootTest,
			};
		}

		const nestedTest = {
			extension: nestedResult.value?.extension,
			name: nestedResult.value?.name,
			path: nestedResult.value?.path,
			success: true,
		};

		return { nested: nestedTest, root: rootTest };
	});

	expect(results.root.success).toBe(true);
	expect(results.root.name).toBe("get-tfile-root.md");
	expect(results.root.path).toBe("get-tfile-root.md");
	expect(results.root.extension).toBe("md");

	expect(results.nested.success).toBe(true);
	expect(results.nested.name).toBe("nested.md");
	expect(results.nested.path).toBe("get-tfile-nested/folder/nested.md");
	expect(results.nested.extension).toBe("md");
};

export const testGetOpenedTFileErrorCases = async () => {
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
		const noFileResult = (await openedFileServiceWithResult.getOpenedTFile()) as unknown as Result<{
			name: string;
			path: string;
		}>;

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
