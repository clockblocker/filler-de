/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testTrashFolder = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, splitPath } = api;

		// Happy Path: Trash empty folder
		const emptyFolderSplitPath = splitPath("empty-folder");
		const createEmptyResult = await tfolderHelper.createFolder(emptyFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createEmptyResult.isErr()) {
			throw new Error(createEmptyResult.error);
		}

		const trashEmptyResult = await tfolderHelper.trashFolder(emptyFolderSplitPath) as unknown as Result<void>;
		const folderExists1 = app.vault.getAbstractFileByPath("empty-folder") !== null;

		const happyPath1 = {
			createOk: createEmptyResult.isOk(),
			folderExistsAfterTrash: folderExists1,
			trashOk: trashEmptyResult.isOk(),
		};

		// Idempotency: Trash folder that doesn't exist
		const nonexistentSplitPath = splitPath("nonexistent-folder");
		const trashNonexistentResult = await tfolderHelper.trashFolder(nonexistentSplitPath) as unknown as Result<void>;

		const idempotent1 = {
			trashOk: trashNonexistentResult.isOk(),
		};

		// Idempotency: Trash already-trashed folder (trash same folder twice)
		const doubleTrashSplitPath = splitPath("double-trash-folder");
		const createDoubleResult = await tfolderHelper.createFolder(doubleTrashSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createDoubleResult.isErr()) {
			throw new Error(createDoubleResult.error);
		}

		const trashResult1 = await tfolderHelper.trashFolder(doubleTrashSplitPath) as unknown as Result<void>;
		const trashResult2 = await tfolderHelper.trashFolder(doubleTrashSplitPath) as unknown as Result<void>;

		const idempotent2 = {
			firstTrashOk: trashResult1.isOk(),
			secondTrashOk: trashResult2.isOk(),
		};

		// Error Cases: Path points to file
		// Note: trashFolder calls getFolder internally, which returns error for files
		// But trashFolder treats getFolder errors as "already trashed" and returns ok
		const fileSplitPath = splitPath("error-file.md");
		const fileCreateResult = await tfileHelper.upsertMdFile({
			content: "# Error file",
			splitPath: fileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (fileCreateResult.isErr()) {
			throw new Error(fileCreateResult.error);
		}

		// Verify getFolder would error (type mismatch)
		const getFolderResult = await tfolderHelper.getFolder(fileSplitPath) as unknown as Result<{ name: string; path: string }>;
		const trashFileAsFolderResult = await tfolderHelper.trashFolder(fileSplitPath) as unknown as Result<void>;

		const error1 = {
			getFolderIsErr: getFolderResult.isErr(),
			trashOk: trashFileAsFolderResult.isOk(),
			// trashFolder returns ok even when getFolder fails (treats as already trashed)
		};

		// With Contents: Trash folder with files
		const folderWithFilesSplitPath = splitPath("folder-with-files");
		const createFolderWithFilesResult = await tfolderHelper.createFolder(folderWithFilesSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createFolderWithFilesResult.isErr()) {
			throw new Error(createFolderWithFilesResult.error);
		}

		const file1SplitPath = splitPath("folder-with-files/file1.md");
		const file2SplitPath = splitPath("folder-with-files/file2.md");
		const createFile1Result = await tfileHelper.upsertMdFile({
			content: "# File 1",
			splitPath: file1SplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const createFile2Result = await tfileHelper.upsertMdFile({
			content: "# File 2",
			splitPath: file2SplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createFile1Result.isErr() || createFile2Result.isErr()) {
			throw new Error("Failed to create files in folder");
		}

		const trashWithFilesResult = await tfolderHelper.trashFolder(folderWithFilesSplitPath) as unknown as Result<void>;
		const folderExists2 = app.vault.getAbstractFileByPath("folder-with-files") !== null;
		const file1Exists = app.vault.getAbstractFileByPath("folder-with-files/file1.md") !== null;
		const file2Exists = app.vault.getAbstractFileByPath("folder-with-files/file2.md") !== null;

		const withContents1 = {
			createOk: createFolderWithFilesResult.isOk(),
			file1Created: createFile1Result.isOk(),
			file1ExistsAfterTrash: file1Exists,
			file2Created: createFile2Result.isOk(),
			file2ExistsAfterTrash: file2Exists,
			folderExistsAfterTrash: folderExists2,
			trashOk: trashWithFilesResult.isOk(),
		};

		// With Contents: Trash folder with nested folders
		const parentFolderSplitPath = splitPath("parent-with-nested");
		const createParentResult = await tfolderHelper.createFolder(parentFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createParentResult.isErr()) {
			throw new Error(createParentResult.error);
		}

		const nestedFolderSplitPath = splitPath("parent-with-nested/nested-folder");
		const createNestedResult = await tfolderHelper.createFolder(nestedFolderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createNestedResult.isErr()) {
			throw new Error(createNestedResult.error);
		}

		const nestedFileSplitPath = splitPath("parent-with-nested/nested-folder/nested-file.md");
		const createNestedFileResult = await tfileHelper.upsertMdFile({
			content: "# Nested file",
			splitPath: nestedFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createNestedFileResult.isErr()) {
			throw new Error(createNestedFileResult.error);
		}

		const trashWithNestedResult = await tfolderHelper.trashFolder(parentFolderSplitPath) as unknown as Result<void>;
		const parentExists = app.vault.getAbstractFileByPath("parent-with-nested") !== null;
		const nestedExists = app.vault.getAbstractFileByPath("parent-with-nested/nested-folder") !== null;
		const nestedFileExists = app.vault.getAbstractFileByPath("parent-with-nested/nested-folder/nested-file.md") !== null;

		const withContents2 = {
			createOk: createParentResult.isOk(),
			nestedCreateOk: createNestedResult.isOk(),
			nestedExistsAfterTrash: nestedExists,
			nestedFileCreateOk: createNestedFileResult.isOk(),
			nestedFileExistsAfterTrash: nestedFileExists,
			parentExistsAfterTrash: parentExists,
			trashOk: trashWithNestedResult.isOk(),
		};

		return { error1, happyPath1, idempotent1, idempotent2, withContents1, withContents2 };
	});

	// Happy Path assertions
	expect(results.happyPath1.createOk).toBe(true);
	expect(results.happyPath1.trashOk).toBe(true);
	expect(results.happyPath1.folderExistsAfterTrash).toBe(false);

	// Idempotency assertions
	expect(results.idempotent1.trashOk).toBe(true);

	expect(results.idempotent2.firstTrashOk).toBe(true);
	expect(results.idempotent2.secondTrashOk).toBe(true);

	// Error Cases assertions
	// getFolder should error (type mismatch), but trashFolder returns ok (idempotent)
	expect(results.error1.getFolderIsErr).toBe(true);
	expect(results.error1.trashOk).toBe(true);

	// With Contents assertions
	expect(results.withContents1.createOk).toBe(true);
	expect(results.withContents1.file1Created).toBe(true);
	expect(results.withContents1.file2Created).toBe(true);
	expect(results.withContents1.trashOk).toBe(true);
	expect(results.withContents1.folderExistsAfterTrash).toBe(false);
	expect(results.withContents1.file1ExistsAfterTrash).toBe(false);
	expect(results.withContents1.file2ExistsAfterTrash).toBe(false);

	expect(results.withContents2.createOk).toBe(true);
	expect(results.withContents2.nestedCreateOk).toBe(true);
	expect(results.withContents2.nestedFileCreateOk).toBe(true);
	expect(results.withContents2.trashOk).toBe(true);
	expect(results.withContents2.parentExistsAfterTrash).toBe(false);
	expect(results.withContents2.nestedExistsAfterTrash).toBe(false);
	expect(results.withContents2.nestedFileExistsAfterTrash).toBe(false);
};
