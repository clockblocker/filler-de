/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
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
});
