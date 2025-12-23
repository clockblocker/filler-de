/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testCreateFile } from "./t-abstract-file-helpers/create-file.test";
import { testUpsertMdFileErrors } from "./t-abstract-file-helpers/create-file-errors.test";
import { testUpsertMdFileHappyPath } from "./t-abstract-file-helpers/create-file-happy.test";
import { testUpsertMdFileIdempotent } from "./t-abstract-file-helpers/create-file-idempotent.test";
import { testUpsertMdFileRaceConditions } from "./t-abstract-file-helpers/create-file-race.test";
import { testCreateFolder } from "./t-abstract-file-helpers/create-folder.test";
import { testCreateFolderAdvanced } from "./t-abstract-file-helpers/create-folder-advanced.test";
import { testGetFileErrors } from "./t-abstract-file-helpers/get-file-errors.test";
import { testGetFileHappyPath } from "./t-abstract-file-helpers/get-file-happy.test";
import { testGetFolder } from "./t-abstract-file-helpers/get-folder.test";
import { testRenameFile } from "./t-abstract-file-helpers/rename-file.test";
import { testRenameFolder } from "./t-abstract-file-helpers/rename-folder.test";
import { testTrashFile } from "./t-abstract-file-helpers/trash-file.test";
import { testTrashFolder } from "./t-abstract-file-helpers/trash-folder.test";
import { VAULT_PATH } from "./t-abstract-file-helpers/utils";

describe("TFileHelper and TFolderHelper", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await (app as any).commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
			// Store runTest helper code as string - can be serialized!
			(globalThis as { __runTestCode?: string }).__runTestCode = `
				const runTest = async (name, setup) => {
					const { filePath, expectedName, expectedPath } = await setup();
					const fileSplitPath = splitPath(filePath);
					const getResult = await tfileHelper.getFile(fileSplitPath);
					
					if (getResult.isErr()) {
						return { error: getResult.error, name };
					}
					
					return {
						expectedName,
						expectedPath,
						fileName: getResult.value?.name,
						filePath: getResult.value?.path,
						name,
						success: true,
					};
				};
			`;
			// Store runErrorTest helper code as string - can be serialized!
			(globalThis as { __runErrorTestCode?: string }).__runErrorTestCode = `
				const runErrorTest = async (name, setup) => {
					const setupResult = await setup();
					const path = setupResult.path;
					const expectedError = setupResult.expectedError;
					
					try {
						const pathSplit = splitPath(path);
						const getResult = await tfileHelper.getFile(pathSplit);
						
						if (getResult.isErr()) {
							return { error: getResult.error, isErr: true, name };
						}
						
						return { message: \`Expected error for \${name}\`, name, success: false };
					} catch (error) {
						return { error: String(error), expectedError, isErr: true, name };
					}
				};
			`;
		});
	});

	it("should create and get a folder", testCreateFolder);

	describe("createFolder() - Advanced", () => {
		it("should handle idempotency, nested folders, and special characters", testCreateFolderAdvanced);
	});

	it("should create and get a markdown file", testCreateFile);

	describe("upsertMdFile() - Happy Path", () => {
		it("should create files (with content, empty content, nested)", testUpsertMdFileHappyPath);
	});

	describe("upsertMdFile() - Idempotency", () => {
		it("should be idempotent (already exists, multiple times)", testUpsertMdFileIdempotent);
	});

	describe("upsertMdFile() - Race Conditions", () => {
		it("should handle race conditions (concurrent creates, external creation)", testUpsertMdFileRaceConditions);
	});

	describe("upsertMdFile() - Error Cases", () => {
		it("should return errors (parent not exists, invalid path)", testUpsertMdFileErrors);
	});

	describe("getFile() - Happy Path", () => {
		it("should get existing files (markdown, non-md, nested)", testGetFileHappyPath);
	});

	describe("getFile() - Error Cases", () => {
		it("should return errors (not exists, points to folder, invalid path)", testGetFileErrors);
	});

	describe("getFolder()", () => {
		it("should get folders (happy path, errors)", testGetFolder);
	});

	describe("trashFile()", () => {
		it("should trash files (happy path, idempotency, errors)", testTrashFile);
	});

	describe("trashFolder()", () => {
		it("should trash folders (happy path, idempotency, errors, with contents)", testTrashFolder);
	});

	describe("renameFile()", () => {
		it("should rename files (happy path, move, skip, idempotency, errors)", testRenameFile);
	});

	describe("renameFolder()", () => {
		it("should rename folders (happy path, move, skip, idempotency, errors)", testRenameFolder);
	});
});
