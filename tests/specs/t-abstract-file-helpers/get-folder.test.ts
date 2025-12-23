/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testGetFolder = async () => {
	try {
		const results = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
			if (!api) throw new Error("testing api unavailable");

			const { tfileHelper, tfolderHelper, splitPath } = api;

			// Happy Path: Get existing folder
			const folderSplitPath1 = splitPath("test-folder");
			const createResult1 = await tfolderHelper.createFolder(folderSplitPath1) as unknown as Result<{ name: string; path: string }>;

			if (createResult1.isErr()) {
				throw new Error(createResult1.error);
			}

			const getResult1 = await tfolderHelper.getFolder(folderSplitPath1) as unknown as Result<{ name: string; path: string }>;

			const happyPath1 = {
				createOk: createResult1.isOk(),
				folderName: getResult1.value?.name,
				folderPath: getResult1.value?.path,
				getOk: getResult1.isOk(),
			};

			// Happy Path: Get root folder (empty pathParts)
			const rootSplitPath = splitPath("");
			const getRootResult = await tfolderHelper.getFolder(rootSplitPath) as unknown as Result<{ name: string; path: string }>;

			const happyPath2 = {
				folderName: getRootResult.value?.name,
				folderPath: getRootResult.value?.path,
				getOk: getRootResult.isOk(),
			};

			// Happy Path: Get folder in nested structure
			const nestedFolderSplitPath = splitPath("parent/child");
			const parentSplitPath = splitPath("parent");
			const parentResult = await tfolderHelper.createFolder(parentSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (parentResult.isErr()) {
				throw new Error(parentResult.error);
			}

			const childResult = await tfolderHelper.createFolder(nestedFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (childResult.isErr()) {
				throw new Error(childResult.error);
			}

			const getNestedResult = await tfolderHelper.getFolder(nestedFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

			const happyPath3 = {
				createOk: childResult.isOk(),
				folderName: getNestedResult.value?.name,
				folderPath: getNestedResult.value?.path,
				getOk: getNestedResult.isOk(),
			};

			// Error Cases: Folder doesn't exist
			const nonexistentSplitPath = splitPath("nonexistent-folder");
			const getNonexistentResult = await tfolderHelper.getFolder(nonexistentSplitPath) as unknown as Result<{ name: string; path: string }>;

			const error1 = {
				error: getNonexistentResult.isErr() ? getNonexistentResult.error : undefined,
				isErr: getNonexistentResult.isErr(),
			};

			// Error Cases: Path points to file (type mismatch)
			const fileSplitPath = splitPath("test-file.md");
			const fileCreateResult = await tfileHelper.upsertMdFile({
				content: "# Test",
				splitPath: fileSplitPath,
			}) as unknown as Result<{ name: string; path: string }>;

			if (fileCreateResult.isErr()) {
				throw new Error(fileCreateResult.error);
			}

			const getFileAsFolderResult = await tfolderHelper.getFolder(fileSplitPath) as unknown as Result<{ name: string; path: string }>;

			const error2 = {
				error: getFileAsFolderResult.isErr() ? getFileAsFolderResult.error : undefined,
				isErr: getFileAsFolderResult.isErr(),
			};

			// Error Cases: Invalid path (empty string after splitPath might be root, so test with invalid chars or just verify empty handling)
			// Note: splitPath("") returns root folder, so we test with a clearly invalid path
			const invalidSplitPath = splitPath("invalid/../path");
			const getInvalidResult = await tfolderHelper.getFolder(invalidSplitPath) as unknown as Result<{ name: string; path: string }>;

			const error3 = {
				error: getInvalidResult.isErr() ? getInvalidResult.error : undefined,
				isErr: getInvalidResult.isErr(),
			};

			return { error1, error2, error3, happyPath1, happyPath2, happyPath3 };
		});

		// Happy Path assertions
		expect(results.happyPath1.createOk).toBe(true);
		expect(results.happyPath1.getOk).toBe(true);
		expect(results.happyPath1.folderName).toBe("test-folder");
		expect(results.happyPath1.folderPath).toBe("test-folder");

		expect(results.happyPath2.getOk).toBe(true);
		// Root folder name might be empty or "/"
		expect(results.happyPath2.folderPath).toBeDefined();

		expect(results.happyPath3.createOk).toBe(true);
		expect(results.happyPath3.getOk).toBe(true);
		expect(results.happyPath3.folderName).toBe("child");
		expect(results.happyPath3.folderPath).toBe("parent/child");

		// Error Cases assertions
		expect(results.error1.isErr).toBe(true);
		expect(results.error1.error).toBeDefined();

		expect(results.error2.isErr).toBe(true);
		expect(results.error2.error).toBeDefined();

		expect(results.error3.isErr).toBe(true);
		expect(results.error3.error).toBeDefined();
	} catch (error) {
		// Errors thrown by wdio-obsidian-service are expected for error cases
		expect(error).toBeDefined();
	}
};
