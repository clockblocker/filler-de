/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
	testInitHealing,
	testInitHealingNoOpForCorrectFiles,
} from "./librarian-healing/init-healing.test";
import { VAULT_PATH } from "./librarian-healing/utils";

describe("Librarian Healing", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await browser.executeObsidian(async ({ app }) => {
			await (app as any).commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		});
	});

	describe("Mode 2: Init Healing", () => {
		it("should heal files with wrong suffixes on init", testInitHealing);
		it(
			"should not rename files with correct suffixes",
			testInitHealingNoOpForCorrectFiles,
		);
	});
});
