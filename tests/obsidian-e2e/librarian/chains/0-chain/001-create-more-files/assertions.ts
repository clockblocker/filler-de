/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import { VAULT_EXPECTATIONS_001 } from "./vault-expectations";

export async function testPostHealing001(): Promise<void> {
	const t = createTestContext("testPostHealing001");
	await t.expectPostHealing(VAULT_EXPECTATIONS_001.postHealing, HEALING_POLL_OPTIONS);
}
