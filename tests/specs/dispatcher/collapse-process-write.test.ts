/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testCollapseProcessWrite = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Create file first
		const fileSplitPath = splitPath("process-write-test.md");
		await manager.dispatch([
			{
				payload: {
					content: "original",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Process then write on same file - write should discard process
		const actions = [
			{
				payload: {
					splitPath: fileSplitPath,
					transform: (c: string) => `${c}!`,
				},
				type: "ProcessMdFile",
			},
			{
				payload: {
					content: "final",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		];

		await manager.dispatch(actions);

		// Verify write wins: content should be "final" (not "original!")
		const content = await manager.readContent(fileSplitPath);

		return {
			content,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.content).toBe("final");
};
