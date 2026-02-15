/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import { VAULT_EXPECTATIONS_003 } from "./vault-expectations";

export async function testPostHealing003(): Promise<void> {
	const t = createTestContext("testPostHealing003");
	await t.gatherDebug("Library/Recipe/Pie/Berry");
	await t.expectPostHealing(VAULT_EXPECTATIONS_003.postHealing, {
		...HEALING_POLL_OPTIONS,
		logFolderOnFail: "Library/Recipe/Pie/Berry",
	});
}
