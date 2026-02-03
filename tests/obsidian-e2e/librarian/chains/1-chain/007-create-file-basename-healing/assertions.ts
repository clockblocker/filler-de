/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import { VAULT_EXPECTATIONS_007 } from "./vault-expectations";

export async function testPostHealing007(): Promise<void> {
	const t = createTestContext("testPostHealing007");
	await t.gatherDebug("Library/Recipe/Soup/Ramen");
	await t.expectPostHealing(VAULT_EXPECTATIONS_007.postHealing, {
		...HEALING_POLL_OPTIONS,
		logFolderOnFail: "Library/Recipe/Soup/Ramen",
	});
}
