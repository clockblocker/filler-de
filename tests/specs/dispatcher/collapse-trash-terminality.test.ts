/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testCollapseTrashTerminality = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, makeSplitPath } = api;

		// Create file first
		const fileSplitPath = splitPath("trash-terminality-test.md");
		await manager.dispatch([
			{
				payload: {
					content: "content",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Multiple operations then trash - trash should win
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
					content: "new content",
					splitPath: fileSplitPath,
				},
				type: "UpsertMdFile",
			},
			{
				payload: {
					splitPath: fileSplitPath,
				},
				type: "TrashMdFile",
			},
		];

		await manager.dispatch(actions);

		// Verify file was trashed (doesn't exist)
		const exists = await manager.exists(fileSplitPath);

		return {
			exists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.exists).toBe(false);
};
