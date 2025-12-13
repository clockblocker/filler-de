/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testCreateFolder = async () => {
	const result = await browser.executeObsidian(async ({ app }) => {
		// Inline definitions required - browser.executeObsidian serializes functions
		// API must be obtained here because app is only available in this context
		const getHelpersApi = () => {
			const plugin = app.plugins.plugins["cbcr-text-eater-de"] as unknown as {
				getHelpersTestingApi?: () => HelpersTestingApi;
			};
			const api = plugin.getHelpersTestingApi?.();
			if (!api) throw new Error("testing api unavailable");
			return api;
		};

		const createFolderLogic = async ({ tfolderHelper, splitPath }: HelpersTestingApi) => {
			const folderSplitPath = splitPath("test-folder");
			
			const asResult = <T>(r: unknown): Result<T> => r as Result<T>;
			const createResult = asResult<{ name: string; path: string }>(
				await tfolderHelper.createFolder(folderSplitPath),
			);
		
			if (createResult.isErr()) {
				return { error: createResult.error };
			}
		
			const getResult = asResult<{ name: string; path: string }>(
				await tfolderHelper.getFolder(folderSplitPath),
			);
		
			if (getResult.isErr()) {
				return { error: getResult.error };
			}
		
			return {
				folderName: getResult.value?.name,
				folderPath: getResult.value?.path,
				success: true,
			};
		};

		return await createFolderLogic(getHelpersApi());
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.folderName).toBe("test-folder");
	expect(result.folderPath).toBe("test-folder");
};


