/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testSingleActionHappyPath = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Create a single UpsertMdFile action
		const fileSplitPath = splitPath("dispatcher-test.md");
		const action = {
			payload: {
				content: "# Dispatcher Test",
				splitPath: fileSplitPath,
			},
			type: "UpsertMdFile",
		};

		// Dispatch the action
		await manager.dispatch([action]);

		// Verify file was created by reading it
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
	expect(result.content).toBe("# Dispatcher Test");
};
