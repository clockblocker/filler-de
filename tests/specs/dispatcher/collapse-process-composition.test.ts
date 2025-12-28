/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testCollapseProcessComposition = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, makeSplitPath } = api;

		// Create file first
		const fileSplitPath = splitPath("process-compose-test.md");
		await manager.dispatch([
			{
				payload: {
					content: "initial",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Multiple ProcessMdFile actions on same file - should compose
		const actions = [
			{
				payload: {
					splitPath: fileSplitPath,
					transform: (c: string) => `${c}A`,
				},
				type: "ProcessMdFile",
			},
			{
				payload: {
					splitPath: fileSplitPath,
					transform: (c: string) => `${c}B`,
				},
				type: "ProcessMdFile",
			},
		];

		await manager.dispatch(actions);

		// Verify transforms were composed: initial -> initialA -> initialAB
		const content = await manager.readContent(fileSplitPath);

		return {
			content,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.content).toBe("initialAB");
};
