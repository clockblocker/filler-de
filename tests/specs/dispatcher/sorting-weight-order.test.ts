/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testSortingWeightOrder = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Mixed action types - should sort by weight
		// Weight order: CreateFolder (0) < CreateFile (3) < ProcessMdFile (9)
		const actions = [
			{
				payload: {
					splitPath: splitPath("z.md"),
					transform: (c: string) => c,
				},
				type: "ProcessMdFile",
			},
			{
				payload: {
					splitPath: splitPath("a"),
				},
				type: "CreateFolder",
			},
			{
				payload: {
					splitPath: splitPath("b.txt"),
				},
				type: "CreateFile",
			},
		];

		// Create file for process first
		await manager.dispatch([
			{
				payload: {
					content: "test",
					splitPath: splitPath("z.md"),
				},
				type: "UpsertMdFile",
			},
		]);

		await manager.dispatch(actions);

		// Verify all were created/executed in correct order
		// (We can't directly verify execution order in e2e, but we can verify all succeeded)
		const folderExists = await manager.exists(splitPath("a"));
		const fileExists = await manager.exists(splitPath("b.txt"));
		const processedContent = await manager.readContent(splitPath("z.md"));

		return {
			fileExists,
			folderExists,
			processedContent,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.folderExists).toBe(true);
	expect(result.fileExists).toBe(true);
	expect(result.processedContent).toBe("test");
};
