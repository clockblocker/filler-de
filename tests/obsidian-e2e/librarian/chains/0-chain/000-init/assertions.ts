/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { VAULT_EXPECTATIONS_000 } from "./vault-expectations";

export async function testAllCodexesCreatedOnInit(): Promise<void> {
	const t = createTestContext("testAllCodexesCreatedOnInit");
	await t.expectFiles(VAULT_EXPECTATIONS_000.postHealing.codexes);
}

export async function testAllFilesSuffixedOnInit(): Promise<void> {
	const t = createTestContext("testAllFilesSuffixedOnInit");
	await t.expectFiles(VAULT_EXPECTATIONS_000.postHealing.files);
}
