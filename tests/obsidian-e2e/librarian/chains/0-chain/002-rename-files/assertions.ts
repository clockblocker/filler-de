/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import { VAULT_EXPECTATIONS_002 } from "./vault-expectations";

export async function testPostHealing002(): Promise<void> {
	const t = createTestContext("testPostHealing002");
	await t.gatherDebug("Library/Recipe");
	await t.expectPostHealing(VAULT_EXPECTATIONS_002.postHealing, {
		...HEALING_POLL_OPTIONS,
		logFolderOnFail: "Library/Recipe",
	});
}
