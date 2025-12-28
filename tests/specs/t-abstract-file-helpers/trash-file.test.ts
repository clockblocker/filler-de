/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testTrashFile = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, makeSplitPath } = api;

		// Happy Path: Trash existing file
		const fileSplitPath1 = splitPath("trash-me.md");
		const createResult1 = await tfileHelper.upsertMdFile({
			content: "# Trash me",
			splitPath: fileSplitPath1,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createResult1.isErr()) {
			throw new Error(createResult1.error);
		}

		const trashResult1 = await tfileHelper.trashFile(fileSplitPath1) as unknown as Result<void>;
		const fileExists1 = app.vault.getAbstractFileByPath("trash-me.md") !== null;

		const happyPath1 = {
			createOk: createResult1.isOk(),
			fileExistsAfterTrash: fileExists1,
			trashOk: trashResult1.isOk(),
		};

		// Happy Path: Trash file in nested folder
		const folderSplitPath = splitPath("nested/trash");
		const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (folderResult.isErr()) {
			throw new Error(folderResult.error);
		}

		const nestedFileSplitPath = splitPath("nested/trash/file.md");
		const createResult2 = await tfileHelper.upsertMdFile({
			content: "# Nested trash",
			splitPath: nestedFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createResult2.isErr()) {
			throw new Error(createResult2.error);
		}

		const trashResult2 = await tfileHelper.trashFile(nestedFileSplitPath) as unknown as Result<void>;
		const fileExists2 = app.vault.getAbstractFileByPath("nested/trash/file.md") !== null;

		const happyPath2 = {
			createOk: createResult2.isOk(),
			fileExistsAfterTrash: fileExists2,
			trashOk: trashResult2.isOk(),
		};

		// Idempotency: Trash file that doesn't exist
		const nonexistentSplitPath = splitPath("nonexistent-trash.md");
		const trashResult3 = await tfileHelper.trashFile(nonexistentSplitPath) as unknown as Result<void>;

		const idempotent1 = {
			trashOk: trashResult3.isOk(),
		};

		// Idempotency: Trash already-trashed file (trash same file twice)
		const fileSplitPath2 = splitPath("double-trash.md");
		const createResult3 = await tfileHelper.upsertMdFile({
			content: "# Double trash",
			splitPath: fileSplitPath2,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createResult3.isErr()) {
			throw new Error(createResult3.error);
		}

		const trashResult4 = await tfileHelper.trashFile(fileSplitPath2) as unknown as Result<void>;
		const trashResult5 = await tfileHelper.trashFile(fileSplitPath2) as unknown as Result<void>;

		const idempotent2 = {
			firstTrashOk: trashResult4.isOk(),
			secondTrashOk: trashResult5.isOk(),
		};

		// Error Cases: Path points to folder
		// Note: trashFile calls getFile internally, which returns error for folders
		// But trashFile treats getFile errors as "already trashed" and returns ok
		// So we verify that getFile would error, but trashFile returns ok (idempotent behavior)
		const folderSplitPath2 = splitPath("error-folder");
		const folderResult2 = await tfolderHelper.createFolder(folderSplitPath2) as unknown as Result<{ name: string; path: string }>;

		if (folderResult2.isErr()) {
			throw new Error(folderResult2.error);
		}

		// Verify getFile would error (type mismatch)
		const getFileResult = await tfileHelper.getFile(folderSplitPath2) as unknown as Result<{ name: string; path: string }>;
		const trashFolderResult = await tfileHelper.trashFile(folderSplitPath2) as unknown as Result<void>;

		const error1 = {
			getFileIsErr: getFileResult.isErr(),
			trashOk: trashFolderResult.isOk(),
			// trashFile returns ok even when getFile fails (treats as already trashed)
		};

		return { error1, happyPath1, happyPath2, idempotent1, idempotent2 };
	});

	// Happy Path assertions
	expect(results.happyPath1.createOk).toBe(true);
	expect(results.happyPath1.trashOk).toBe(true);
	expect(results.happyPath1.fileExistsAfterTrash).toBe(false);

	expect(results.happyPath2.createOk).toBe(true);
	expect(results.happyPath2.trashOk).toBe(true);
	expect(results.happyPath2.fileExistsAfterTrash).toBe(false);

	// Idempotency assertions
	expect(results.idempotent1.trashOk).toBe(true);

	expect(results.idempotent2.firstTrashOk).toBe(true);
	expect(results.idempotent2.secondTrashOk).toBe(true);

	// Error Cases assertions
	// getFile should error (type mismatch), but trashFile returns ok (idempotent)
	expect(results.error1.getFileIsErr).toBe(true);
	expect(results.error1.trashOk).toBe(true);
};
