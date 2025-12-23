/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testCollapseMultipleFiles = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Create files first
		const fileASplitPath = splitPath("multi-file-a.md");
		const fileBSplitPath = splitPath("multi-file-b.md");

		await manager.dispatch([
			{
				payload: {
					content: "a",
					splitPath: fileASplitPath,
				},
				type: "UpsertMdFile",
			},
			{
				payload: {
					content: "b",
					splitPath: fileBSplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Process on different files - should remain separate
		const actions = [
			{
				payload: {
					splitPath: fileASplitPath,
					transform: (c: string) => `${c}A`,
				},
				type: "ProcessMdFile",
			},
			{
				payload: {
					splitPath: fileBSplitPath,
					transform: (c: string) => `${c}B`,
				},
				type: "ProcessMdFile",
			},
		];

		await manager.dispatch(actions);

		// Verify both files processed separately
		const contentA = await manager.readContent(fileASplitPath);
		const contentB = await manager.readContent(fileBSplitPath);

		return {
			contentA,
			contentB,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.contentA).toBe("aA");
	expect(result.contentB).toBe("bB");
};
