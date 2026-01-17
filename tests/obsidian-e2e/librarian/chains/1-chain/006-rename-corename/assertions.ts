/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import { VAULT_EXPECTATIONS_006 } from "./vault-expectations";

export async function testPostHealing006(): Promise<void> {
	const t = createTestContext("testPostHealing006");
	await t.gatherDebug("Library/Recipe/Soup/Ramen");
	await t.expectPostHealing(VAULT_EXPECTATIONS_006.postHealing, {
		...HEALING_POLL_OPTIONS,
		logFolderOnFail: "Library/Recipe/Soup/Ramen",
	});
}
