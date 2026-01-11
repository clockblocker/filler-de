/// <reference types="@wdio/globals/types" />
import { expectFilesToExist } from "../../../../support/api";
import { VAULT_EXPECTATIONS_001 } from "./vault-expectations";

export async function testPostHealing001(): Promise<void> {
	await expectFilesToExist(
		[
			...VAULT_EXPECTATIONS_001.postHealing.codexes,
			...VAULT_EXPECTATIONS_001.postHealing.files,
		],
		{
			callerContext: "[testPostHealing001]",
			intervalMs: 200, // Check less frequently to give Obsidian more time
			timeoutMs: 15000, // Allow more time for codex files to be registered by Obsidian
		},
	);
}