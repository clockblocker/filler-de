/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testQueueBehavior = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, makeSplitPath } = api;

		// Dispatch multiple actions in quick succession
		// Queue should batch them and execute in order
		const file1Path = splitPath("queue-test-1.md");
		const file2Path = splitPath("queue-test-2.md");
		const file3Path = splitPath("queue-test-3.md");

		// Dispatch all at once (should be batched)
		const dispatch1 = manager.dispatch([
			{
				payload: {
					content: "File 1",
					splitPath: file1Path,
				},
				type: "UpsertMdFile",
			},
		]);

		const dispatch2 = manager.dispatch([
			{
				payload: {
					content: "File 2",
					splitPath: file2Path,
				},
				type: "UpsertMdFile",
			},
		]);

		const dispatch3 = manager.dispatch([
			{
				payload: {
					content: "File 3",
					splitPath: file3Path,
				},
				type: "UpsertMdFile",
			},
		]);

		// Wait for all dispatches to complete
		await Promise.all([dispatch1, dispatch2, dispatch3]);

		// Verify all files were created
		const exists1 = await manager.exists(file1Path);
		const exists2 = await manager.exists(file2Path);
		const exists3 = await manager.exists(file3Path);

		// Verify content
		const content1 = await manager.readContent(file1Path);
		const content2 = await manager.readContent(file2Path);
		const content3 = await manager.readContent(file3Path);

		return {
			content1,
			content2,
			content3,
			exists1,
			exists2,
			exists3,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	// All files should exist (queue executed all batches)
	expect(result.exists1).toBe(true);
	expect(result.exists2).toBe(true);
	expect(result.exists3).toBe(true);
	// Content should be correct
	expect(result.content1).toBe("File 1");
	expect(result.content2).toBe("File 2");
	expect(result.content3).toBe("File 3");
};
