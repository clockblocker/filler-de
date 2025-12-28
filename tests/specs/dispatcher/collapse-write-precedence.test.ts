/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testCollapseWritePrecedence = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, makeSplitPath } = api;

		// Create multiple UpsertMdFile actions on same file
		const fileSplitPath = splitPath("collapse-test.md");
		const actions = [
			{
				payload: {
					content: "first",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
			{
				payload: {
					content: "second",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		];

		// Dispatch actions - collapse should merge them
		await manager.dispatch(actions);

		// Verify final content is "second" (latest write wins)
		const content = await manager.readContent(fileSplitPath);

		return {
			content,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.content).toBe("second");
};
