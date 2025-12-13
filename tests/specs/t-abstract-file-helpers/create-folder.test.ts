/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testCreateFolder = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		// Inline definitions required - browser.executeObsidian serializes functions
		// API must be obtained here because app is only available in this context
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfolderHelper, splitPath } = api;

		const folderSplitPath = splitPath("test-folder");
		
		const createResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (createResult.isErr()) {
			return { error: createResult.error };
		}

		const getResult = await tfolderHelper.getFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (getResult.isErr()) {
			return { error: getResult.error };
		}

		return {
			folderName: getResult.value?.name,
			folderPath: getResult.value?.path,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.folderName).toBe("test-folder");
	expect(result.folderPath).toBe("test-folder");
};


