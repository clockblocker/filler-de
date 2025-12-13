/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testCreateFile } from "./t-abstract-file-helpers/create-file.test";
import { testCreateFolder } from "./t-abstract-file-helpers/create-folder.test";
import {
	testGetFileMarkdown,
	testGetFileNested,
	testGetFileNonMd,
} from "./t-abstract-file-helpers/get-file-happy.test";
import { VAULT_PATH } from "./t-abstract-file-helpers/utils";

describe("TFileHelper and TFolderHelper", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await app.commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
	});

	it("should create and get a folder", testCreateFolder);

	it("should create and get a markdown file", testCreateFile);

	describe("getFile() - Happy Path", () => {
		it("should get existing markdown file", testGetFileMarkdown);
		it("should get existing non-md file", testGetFileNonMd);
		it("should get file in nested folder", testGetFileNested);
	});
});
