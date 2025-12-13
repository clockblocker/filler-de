/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testCollapseWriteProcess = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Write then process on same file
		const fileSplitPath = splitPath("write-process-test.md");
		const actions = [
			{
				payload: {
					content: "hello",
					splitPath: fileSplitPath,
				},
				type: "ReplaceContentMdFile",
			},
			{
				payload: {
					splitPath: fileSplitPath,
					transform: (c: string) => c.toUpperCase(),
				},
				type: "ProcessMdFile",
			},
		];

		await manager.dispatch(actions);

		// Verify process was applied to write content: "hello" -> "HELLO"
		const content = await manager.readContent(fileSplitPath);

		return {
			content,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.content).toBe("HELLO");
};
