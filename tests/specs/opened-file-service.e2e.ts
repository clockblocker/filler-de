/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import { testGetContentErrorCases, testGetContentHappyPath } from "./opened-file-service/get-content.test";
import { testGetOpenedTFileErrorCases, testGetOpenedTFileHappyPath } from "./opened-file-service/get-opened-tfile.test";
import { testPwdErrorCases, testPwdHappyPath } from "./opened-file-service/pwd.test";
import { VAULT_PATH } from "./opened-file-service/utils";

describe("OpenedFileService", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await (app as any).commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
	});

	describe("pwd()", () => {
		it("should return current working directory (happy path)", testPwdHappyPath);
		it("should return error when no file is open", testPwdErrorCases);
	});

	describe("getOpenedTFile()", () => {
		it("should return opened TFile (happy path)", testGetOpenedTFileHappyPath);
		it("should return error when no file is open", testGetOpenedTFileErrorCases);
	});

	describe("getContent()", () => {
		it("should return file content (happy path)", testGetContentHappyPath);
		it("should return error when no file is open", testGetContentErrorCases);
	});
});
