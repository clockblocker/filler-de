/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import { VAULT_EXPECTATIONS_005 } from "./vault-expectations";

export async function testPostHealing005(): Promise<void> {
	const t = createTestContext("testPostHealing005");
	await t.gatherDebug("Library/Recipe/Soup");
	await t.expectPostHealing(VAULT_EXPECTATIONS_005.postHealing, {
		...HEALING_POLL_OPTIONS,
		logFolderOnFail: "Library/Recipe/Soup",
	});
}
