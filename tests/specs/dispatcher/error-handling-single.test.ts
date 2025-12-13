/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "./utils";

export const testErrorHandlingSingle = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { manager, splitPath } = api;

		// Create first file successfully
		const fileASplitPath = splitPath("error-test-a.md");
		await manager.dispatch([
			{
				payload: {
					content: "a",
					splitPath: fileASplitPath,
				},
				type: "CreateMdFile",
			},
		]);

		// Try to create same file again - should fail
		// Note: Obsidian behavior - creating existing file may succeed or fail
		// We'll test with an invalid path instead
		const invalidPath = splitPath(""); // Empty path should fail

		let errorCaught = false;
		let errorMessage = "";

		try {
			await manager.dispatch([
				{
					payload: {
						content: "invalid",
						splitPath: invalidPath,
					},
					type: "CreateMdFile",
				},
			]);
		} catch (error) {
			errorCaught = true;
			errorMessage = error instanceof Error ? error.message : String(error);
		}

		// Verify first file still exists (execution continued)
		const fileAExists = await manager.exists(fileASplitPath);

		return {
			errorCaught,
			errorMessage,
			fileAExists,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	// Error should be caught (dispatch throws on error)
	expect(result.errorCaught).toBe(true);
	// First file should still exist
	expect(result.fileAExists).toBe(true);
};
