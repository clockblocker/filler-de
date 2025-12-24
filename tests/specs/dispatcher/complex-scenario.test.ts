/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testComplexScenario = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Complex scenario: collapse + sort + execute
		// Multiple processes on same file (should collapse)
		// Create folder (should sort first)
		// Write to different file
		const fileASplitPath = splitPath("complex-a.md");
		const fileBSplitPath = splitPath("complex-b.md");
		const folderSplitPath = splitPath("complex-folder");

		// Create file A first for processing
		await manager.dispatch([
			{
				payload: {
					content: "start",
					splitPath: fileASplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		const actions = [
			// Multiple processes on A - should collapse
			{
				payload: {
					splitPath: fileASplitPath,
					transform: (c: string) => `${c}A`,
				},
				type: "ProcessMdFile",
			},
			{
				payload: {
					splitPath: fileASplitPath,
					transform: (c: string) => `${c}B`,
				},
				type: "ProcessMdFile",
			},
			// Create folder - should sort first (weight 0)
			{
				payload: {
					splitPath: folderSplitPath,
				},
				type: "CreateFolder",
			},
			// Write to B
			{
				payload: {
					content: "content",
					splitPath: fileBSplitPath,
				},
				type: "UpsertMdFile",
			},
		];

		await manager.dispatch(actions);

		// Verify results
		const contentA = await manager.readContent(fileASplitPath);
		const contentB = await manager.readContent(fileBSplitPath);
		const folderExists = await manager.exists(folderSplitPath);

		return {
			contentA,
			contentB,
			folderExists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	// Process should be composed: "start" -> "startA" -> "startAB"
	expect(result.contentA).toBe("startAB");
	expect(result.contentB).toBe("content");
	expect(result.folderExists).toBe(true);
};
