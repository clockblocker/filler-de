/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testCollapseCreateWriteMerge = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, makeSplitPath } = api;

		// Create then write on same file - should merge into create with final content
		const fileSplitPath = splitPath("create-write-merge-test.md");
		const actions = [
			{
				payload: {
					content: "initial",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
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

		// Verify file created with final content
		const content = await manager.readContent(fileSplitPath);
		const exists = await manager.exists(fileSplitPath);

		return {
			content,
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.exists).toBe(true);
	expect(result.content).toBe("final");
};
