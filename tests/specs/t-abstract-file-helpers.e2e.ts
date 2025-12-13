/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testCreateFile } from "./t-abstract-file-helpers/create-file.test";
import { testCreateMdFileErrors } from "./t-abstract-file-helpers/create-file-errors.test";
import { testCreateMdFileHappyPath } from "./t-abstract-file-helpers/create-file-happy.test";
import { testCreateMdFileIdempotent } from "./t-abstract-file-helpers/create-file-idempotent.test";
import { testCreateMdFileRaceConditions } from "./t-abstract-file-helpers/create-file-race.test";
import { testCreateFolder } from "./t-abstract-file-helpers/create-folder.test";
import { testGetFileErrors } from "./t-abstract-file-helpers/get-file-errors.test";
import { testGetFileHappyPath } from "./t-abstract-file-helpers/get-file-happy.test";
import { testGetFolder } from "./t-abstract-file-helpers/get-folder.test";
import { testTrashFile } from "./t-abstract-file-helpers/trash-file.test";
import { VAULT_PATH } from "./t-abstract-file-helpers/utils";

describe("TFileHelper and TFolderHelper", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await app.commands.executeCommandById(
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

	it("should create and get a markdown file", testCreateFile);

	describe("createMdFile() - Happy Path", () => {
		it("should create files (with content, empty content, nested)", testCreateMdFileHappyPath);
	});

	describe("createMdFile() - Idempotency", () => {
		it("should be idempotent (already exists, multiple times)", testCreateMdFileIdempotent);
	});

	describe("createMdFile() - Race Conditions", () => {
		it("should handle race conditions (concurrent creates, external creation)", testCreateMdFileRaceConditions);
	});

	describe("createMdFile() - Error Cases", () => {
		it("should return errors (parent not exists, invalid path)", testCreateMdFileErrors);
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
});
