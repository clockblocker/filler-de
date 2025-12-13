/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testCreateFile = async () => {
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
		const asResult = <T>(r: unknown): Result<T> => r as Result<T>;
		const { tfileHelper, splitPath } = getHelpersApi();

		const fileSplitPath = splitPath("test-file.md");
		const createResult = asResult<{ name: string; path: string }>(
			await tfileHelper.createMdFile({
				content: "# Test Content",
				splitPath: fileSplitPath,
			}),
		);

		if (createResult.isErr()) {
			return { error: createResult.error };
		}

		const getResult = asResult<{ name: string; path: string }>(
			await tfileHelper.getFile(fileSplitPath),
		);

		if (getResult.isErr()) {
			return { error: getResult.error };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const content = await app.vault.read(getResult.value as any);

		return {
			content,
			fileName: getResult.value?.name,
			filePath: getResult.value?.path,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.fileName).toBe("test-file.md");
	expect(result.filePath).toBe("test-file.md");
	expect(result.content).toBe("# Test Content");
};
