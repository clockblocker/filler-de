/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type {
	OpenedFileServiceTestingApi,
	Result,
	SplitPathToMdFile,
} from "./utils";

export const testCdHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult, makeSplitPath } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: Open file by TFile
		const tfilePath = "cd-test-tfile.md";
		try {
			await app.vault.create(tfilePath, "# TFile Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const tfile = app.vault.getAbstractFileByPath(tfilePath);
		if (!tfile) throw new Error("Failed to create file for TFile test");

		const tfileResult = (await openedFileServiceWithResult.cd(
			tfile,
		)) as unknown as Result<any>;

		if (tfileResult.isErr()) {
			return {
				tfile: { error: tfileResult.error, success: false },
			};
		}

		// Verify file is active
		const tfilePwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<SplitPathToMdFile>;
		const tfileTest = {
			expectedPath: tfilePath,
			isActive: tfilePwdResult.isOk() && tfilePwdResult.value.basename === "cd-test-tfile",
			returnedPath: tfileResult.value?.path,
			success: true,
		};

		// Test 2: Open file by SplitPathToMdFile
		const splitPathFile = splitPath("cd-test-splitpath.md") as unknown as SplitPathToMdFile;
		try {
			await app.vault.create("cd-test-splitpath.md", "# SplitPath Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}

		const splitPathResult = (await openedFileServiceWithResult.cd(
			splitPathFile,
		)) as unknown as Result<any>;

		if (splitPathResult.isErr()) {
			return {
				splitPath: { error: splitPathResult.error, success: false },
				tfile: tfileTest,
			};
		}

		const splitPathPwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<SplitPathToMdFile>;
		const splitPathTest = {
			expectedPath: "cd-test-splitpath.md",
			isActive: splitPathPwdResult.isOk() && splitPathPwdResult.value.basename === "cd-test-splitpath",
			returnedPath: splitPathResult.value?.path,
			success: true,
		};

		// Test 3: Open nested file
		const nestedFolder = "cd-test-folder";
		const nestedFilePath = `${nestedFolder}/cd-test-nested.md`;
		try {
			await app.vault.createFolder(nestedFolder);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		try {
			await app.vault.create(nestedFilePath, "# Nested Test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}

		const nestedFile = app.vault.getAbstractFileByPath(nestedFilePath);
		if (!nestedFile) throw new Error("Failed to create nested file");

		const nestedResult = (await openedFileServiceWithResult.cd(
			nestedFile,
		)) as unknown as Result<any>;

		if (nestedResult.isErr()) {
			return {
				nested: { error: nestedResult.error, success: false },
				splitPath: splitPathTest,
				tfile: tfileTest,
			};
		}

		const nestedPwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<SplitPathToMdFile>;
		const nestedTest = {
			expectedPath: nestedFilePath,
			isActive: nestedPwdResult.isOk() && nestedPwdResult.value.basename === "cd-test-nested",
			pathPartsMatch: nestedPwdResult.isOk() && nestedPwdResult.value.pathParts.includes("cd-test-folder"),
			returnedPath: nestedResult.value?.path,
			success: true,
		};

		return {
			nested: nestedTest,
			splitPath: splitPathTest,
			tfile: tfileTest,
		};
	});

	expect(results.tfile.success).toBe(true);
	expect(results.tfile.returnedPath).toBe(results.tfile.expectedPath);
	expect(results.tfile.isActive).toBe(true);

	expect(results.splitPath.success).toBe(true);
	expect(results.splitPath.returnedPath).toBe(results.splitPath.expectedPath);
	expect(results.splitPath.isActive).toBe(true);

	expect(results.nested.success).toBe(true);
	expect(results.nested.returnedPath).toBe(results.nested.expectedPath);
	expect(results.nested.isActive).toBe(true);
	expect(results.nested.pathPartsMatch).toBe(true);
};

export const testCdErrorCases = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult, makeSplitPath } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: File doesn't exist (SplitPath)
		const nonexistentSplitPath = splitPath("nonexistent-file.md") as unknown as SplitPathToMdFile;
		const nonexistentResult = (await openedFileServiceWithResult.cd(
			nonexistentSplitPath,
		)) as unknown as Result<any>;

		// Test 2: Invalid argument type
		const invalidResult = (await openedFileServiceWithResult.cd(
			"invalid-string" as any,
		)) as unknown as Result<any>;

		// Test 3: Path points to folder (if applicable)
		const folderPath = "cd-test-folder";
		try {
			await app.vault.createFolder(folderPath);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const folderSplitPath = splitPath(folderPath) as unknown as SplitPathToMdFile;
		const folderResult = (await openedFileServiceWithResult.cd(
			folderSplitPath,
		)) as unknown as Result<any>;

		return {
			folder: {
				error: folderResult.error,
				isErr: folderResult.isErr(),
				success: folderResult.isOk(),
			},
			invalid: {
				error: invalidResult.error,
				isErr: invalidResult.isErr(),
				success: invalidResult.isOk(),
			},
			nonexistent: {
				error: nonexistentResult.error,
				isErr: nonexistentResult.isErr(),
				success: nonexistentResult.isOk(),
			},
		};
	});

	expect(results.nonexistent.success).toBe(false);
	expect(results.nonexistent.isErr).toBe(true);
	expect(results.nonexistent.error).toBeDefined();

	expect(results.invalid.success).toBe(false);
	expect(results.invalid.isErr).toBe(true);
	expect(results.invalid.error).toBeDefined();

	expect(results.folder.success).toBe(false);
	expect(results.folder.isErr).toBe(true);
	expect(results.folder.error).toBeDefined();
};
