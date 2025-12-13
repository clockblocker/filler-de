/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testEmptyActions = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager } = api;

		// Dispatch empty actions array
		await manager.dispatch([]);

		return {
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
};
