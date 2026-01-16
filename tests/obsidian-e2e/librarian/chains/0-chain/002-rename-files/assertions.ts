/// <reference types="@wdio/globals/types" />
import { expectFilesToExist, gatherPluginDebugInfo } from "../../../../support/api";
import { VAULT_EXPECTATIONS_002 } from "./vault-expectations";

export async function testPostHealing002(): Promise<void> {
	// Gather debug info for diagnostics (writes to /tmp/debug-002-rename.log)
	await gatherPluginDebugInfo({
		folderFilter: "Library/Recipe",
		logPath: "/tmp/debug-002-rename.log",
	});

	await expectFilesToExist(
		[
			...VAULT_EXPECTATIONS_002.postHealing.codexes,
			...VAULT_EXPECTATIONS_002.postHealing.files,
		],
		{
			callerContext: "[testPostHealing002]",
			intervalMs: 200,
			logFolderOnFail: "Library/Recipe",
			timeoutMs: 15000,
		},
	);
}
