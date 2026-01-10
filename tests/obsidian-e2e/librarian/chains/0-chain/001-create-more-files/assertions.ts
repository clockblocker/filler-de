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
		},
	);
}