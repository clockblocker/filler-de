/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testCreateFile } from "./t-abstract-file-helpers/create-file.test";
import { testCreateFolder } from "./t-abstract-file-helpers/create-folder.test";
import {
	testGetFileInvalidPath,
	testGetFileNotExists,
	testGetFilePointsToFolder,
} from "./t-abstract-file-helpers/get-file-errors.test";
import { testGetFileHappyPath } from "./t-abstract-file-helpers/get-file-happy.test";
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
		});
	});

	it("should create and get a folder", testCreateFolder);

	it("should create and get a markdown file", testCreateFile);

	describe("getFile() - Happy Path", () => {
		it("should get existing files (markdown, non-md, nested)", testGetFileHappyPath);
	});

	describe("getFile() - Error Cases", () => {
		it("should return error when file doesn't exist", testGetFileNotExists);
		it("should return error when path points to folder", testGetFilePointsToFolder);
		it("should return error for invalid path", testGetFileInvalidPath);
	});
});
