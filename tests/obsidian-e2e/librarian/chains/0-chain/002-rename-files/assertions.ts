/// <reference types="@wdio/globals/types" />
import { expectFilesToExist } from "../../../../support/api";
import { listFilesUnder } from "../../../../support/api/vault-ops";
import { VAULT_EXPECTATIONS_002 } from "./vault-expectations";

export async function testPostHealing002(): Promise<void> {
	await expectFilesToExist(
		[
			...VAULT_EXPECTATIONS_002.postHealing.codexes,
			...VAULT_EXPECTATIONS_002.postHealing.files,
		],
		{
			callerContext: "[testPostHealing002]",
			intervalMs: 200,
			timeoutMs: 15000,
		},
	);

	// Log Recipe/ folder state after healing
	const recipeFilesResult = await listFilesUnder("Library/Recipe");
	if (recipeFilesResult.isOk()) {
		const files = recipeFilesResult.value.sort();
		process.stdout.write("\n=== RECIPE FOLDER STATE AFTER 002 ===\n");
		process.stdout.write(files.join("\n"));
		process.stdout.write("\n=== END RECIPE STATE ===\n");
	}
}
