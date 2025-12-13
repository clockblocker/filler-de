/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
	testCdErrorCases,
	testCdHappyPath,
} from "./opened-file-service/cd.test";
import { testGetContentErrorCases, testGetContentHappyPath } from "./opened-file-service/get-content.test";
import { testGetOpenedTFileErrorCases, testGetOpenedTFileHappyPath } from "./opened-file-service/get-opened-tfile.test";
import { testIsFileActiveErrorCases, testIsFileActiveHappyPath } from "./opened-file-service/is-file-active.test";
import {
	testProcessContentCursorPreservation,
	testProcessContentErrorCases,
	testProcessContentHappyPath,
} from "./opened-file-service/process-content.test";
import { testPwdErrorCases, testPwdHappyPath } from "./opened-file-service/pwd.test";
import {
	testReplaceAllContentErrorCases,
	testReplaceAllContentHappyPath,
	testReplaceAllContentScrollPreservation,
} from "./opened-file-service/replace-all-content.test";
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

	describe("isFileActive()", () => {
		it("should check if file is active (happy path)", testIsFileActiveHappyPath);
		it("should return error when no file is open", testIsFileActiveErrorCases);
	});

	describe("replaceAllContentInOpenedFile()", () => {
		it("should replace content (happy path)", testReplaceAllContentHappyPath);
		it("should preserve scroll position", testReplaceAllContentScrollPreservation);
		it("should return error when no file is open", testReplaceAllContentErrorCases);
	});

	describe("processContent()", () => {
		it("should process content with transform (happy path)", testProcessContentHappyPath);
		it("should preserve cursor position", testProcessContentCursorPreservation);
		it("should return error cases", testProcessContentErrorCases);
	});

	describe("cd()", () => {
		it("should open file (happy path)", testCdHappyPath);
		it("should return error cases", testCdErrorCases);
	});
});
