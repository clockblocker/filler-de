/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testGetFileMarkdown = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, splitPath } = api;

		// Create file first
		const fileSplitPath = splitPath("test.md");
		const createResult = await tfileHelper.createMdFile({
			content: "# Test",
			splitPath: fileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createResult.isErr()) {
			return { error: createResult.error };
		}

		// Get the file
		const getResult = await tfileHelper.getFile(fileSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (getResult.isErr()) {
			return { error: getResult.error };
		}

		return {
			fileName: getResult.value?.name,
			filePath: getResult.value?.path,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.fileName).toBe("test.md");
	expect(result.filePath).toBe("test.md");
};

export const testGetFileNonMd = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, splitPath } = api;

		// Create non-md file using Obsidian API
		const filePath = "test.txt";
		await app.vault.create(filePath, "test content");

		// Get the file
		const fileSplitPath = splitPath(filePath);
		const getResult = await tfileHelper.getFile(fileSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (getResult.isErr()) {
			return { error: getResult.error };
		}

		return {
			fileName: getResult.value?.name,
			filePath: getResult.value?.path,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.fileName).toBe("test.txt");
	expect(result.filePath).toBe("test.txt");
};

export const testGetFileNested = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, splitPath } = api;

		// Create nested folder first
		const folderSplitPath = splitPath("nested/folder");
		const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (folderResult.isErr()) {
			return { error: folderResult.error };
		}

		// Create file in nested folder
		const fileSplitPath = splitPath("nested/folder/file.md");
		const createResult = await tfileHelper.createMdFile({
			content: "# Nested",
			splitPath: fileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		if (createResult.isErr()) {
			return { error: createResult.error };
		}

		// Get the file
		const getResult = await tfileHelper.getFile(fileSplitPath) as unknown as Result<{ name: string; path: string }>;

		if (getResult.isErr()) {
			return { error: getResult.error };
		}

		return {
			fileName: getResult.value?.name,
			filePath: getResult.value?.path,
			success: true,
		};
	});

	expect(result.error).toBeUndefined();
	expect(result.success).toBe(true);
	expect(result.fileName).toBe("file.md");
	expect(result.filePath).toBe("nested/folder/file.md");
};
