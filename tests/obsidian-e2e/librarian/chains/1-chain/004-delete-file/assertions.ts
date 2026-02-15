/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import { VAULT_EXPECTATIONS_004 } from "./vault-expectations";

export async function testPostHealing004(): Promise<void> {
	const t = createTestContext("testPostHealing004");
	await t.gatherDebug("Library/Recipe/Pie/Fish");
	await t.expectPostHealing(VAULT_EXPECTATIONS_004.postHealing, {
		...HEALING_POLL_OPTIONS,
		logFolderOnFail: "Library/Recipe/Pie/Fish",
	});
}
