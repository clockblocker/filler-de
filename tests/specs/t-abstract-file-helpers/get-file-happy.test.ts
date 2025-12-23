/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testGetFileHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, splitPath } = api;

		const runTestCode = (globalThis as { __runTestCode?: string }).__runTestCode;
		if (!runTestCode) {
			throw new Error("runTest code not found - ensure beforeEach ran");
		}

		const runTest = new Function("tfileHelper", "splitPath", runTestCode + " return runTest;")(tfileHelper, splitPath);

		const markdown = await runTest("markdown", async () => {
			const fileSplitPath = splitPath("test.md");
			const createResult = await tfileHelper.upsertMdFile({
				content: "# Test",
				splitPath: fileSplitPath,
			}) as unknown as Result<{ name: string; path: string }>;

			if (createResult.isErr()) {
				throw new Error(createResult.error);
			}

			return { expectedName: "test.md", expectedPath: "test.md", filePath: "test.md" };
		});

		const nonMd = await runTest("nonMd", async () => {
			const filePath = "test.txt";
			await app.vault.create(filePath, "test content");
			return { expectedName: "test.txt", expectedPath: "test.txt", filePath };
		});

		const nested = await runTest("nested", async () => {
			const folderSplitPath = splitPath("nested/folder");
			const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (folderResult.isErr()) {
				throw new Error(folderResult.error);
			}

			const fileSplitPath = splitPath("nested/folder/file.md");
			const createResult = await tfileHelper.upsertMdFile({
				content: "# Nested",
				splitPath: fileSplitPath,
			}) as unknown as Result<{ name: string; path: string }>;

			if (createResult.isErr()) {
				throw new Error(createResult.error);
			}

			return { expectedName: "file.md", expectedPath: "nested/folder/file.md", filePath: "nested/folder/file.md" };
		});

		return { markdown, nested, nonMd };
	});

	expect(results.markdown.error).toBeUndefined();
	expect(results.markdown.success).toBe(true);
	expect(results.markdown.fileName).toBe(results.markdown.expectedName);
	expect(results.markdown.filePath).toBe(results.markdown.expectedPath);

	expect(results.nonMd.error).toBeUndefined();
	expect(results.nonMd.success).toBe(true);
	expect(results.nonMd.fileName).toBe(results.nonMd.expectedName);
	expect(results.nonMd.filePath).toBe(results.nonMd.expectedPath);

	expect(results.nested.error).toBeUndefined();
	expect(results.nested.success).toBe(true);
	expect(results.nested.fileName).toBe(results.nested.expectedName);
	expect(results.nested.filePath).toBe(results.nested.expectedPath);
};
