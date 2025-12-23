/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testCreateFile = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		// Inline definitions required - browser.executeObsidian serializes functions
		// API must be obtained here because app is only available in this context
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, splitPath } = api;

		const fileSplitPath = splitPath("test-file.md");
		
		const createResult = await tfileHelper.upsertMdFile({
			content: "# Test Content",
			splitPath: fileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createResult.isErr()) {
			return { error: createResult.error };
		}

		const getResult = await tfileHelper.getFile(fileSplitPath) as unknown as Result<{ name: string; path: string }>;

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