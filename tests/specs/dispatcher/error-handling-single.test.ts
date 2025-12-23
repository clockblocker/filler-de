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
				type: "UpsertMdFile",
			},
		]);

		// Try to create same file again - should fail
		// Note: Obsidian behavior - creating existing file may succeed or fail
		// We'll test with an invalid path instead
		const invalidPath = splitPath(""); // Empty path should fail

		// Dispatch returns result (not throws)
		const dispatchResult = await manager.dispatch([
			{
				payload: {
					content: "invalid",
					splitPath: invalidPath,
				},
				type: "UpsertMdFile",
			},
		]);

		// Check if result contains errors
		const hasError = dispatchResult.isErr();
		const errorDetails = hasError ? dispatchResult.error : undefined;

		// Verify first file still exists (execution continued)
		const fileAExists = await manager.exists(fileASplitPath);

		return {
			errorDetails,
			fileAExists,
			hasError,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	// Error should be in result (dispatch returns errors, not throws)
	expect(result.hasError).toBe(true);
	expect(result.errorDetails).toBeDefined();
	expect(result.errorDetails?.length).toBeGreaterThan(0);
	// First file should still exist (execution continued despite error)
	expect(result.fileAExists).toBe(true);
};
