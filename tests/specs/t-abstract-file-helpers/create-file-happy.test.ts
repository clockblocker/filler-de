/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testCreateMdFileHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, tfolderHelper, splitPath } = api;

		const runCreateTest = async (name: string, setup: () => Promise<{ filePath: string; content: string; expectedName: string; expectedPath: string }>) => {
			const { filePath, content, expectedName, expectedPath } = await setup();
			const fileSplitPath = splitPath(filePath);
			const createResult = await tfileHelper.createMdFile({
				content,
				splitPath: fileSplitPath,
			}) as unknown as Result<{ name: string; path: string }>;

			if (createResult.isErr()) {
				return { error: createResult.error, name };
			}

			// Verify file was created by reading it
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const fileContent = await app.vault.read(createResult.value as any);

			return {
				content: fileContent,
				expectedContent: content,
				expectedName,
				expectedPath,
				fileName: createResult.value?.name,
				filePath: createResult.value?.path,
				name,
				success: true,
			};
		};

		const withContent = await runCreateTest("withContent", async () => {
			return {
				content: "# Test Content",
				expectedContent: "# Test Content",
				expectedName: "test.md",
				expectedPath: "test.md",
				filePath: "test.md",
			};
		});

		const emptyContent = await runCreateTest("emptyContent", async () => {
			return {
				content: "",
				expectedContent: "",
				expectedName: "empty.md",
				expectedPath: "empty.md",
				filePath: "empty.md",
			};
		});

		const nested = await runCreateTest("nested", async () => {
			// Create parent folder first
			const folderSplitPath = splitPath("parent/child");
			const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (folderResult.isErr()) {
				throw new Error(folderResult.error);
			}

			return {
				content: "# Nested Content",
				expectedContent: "# Nested Content",
				expectedName: "nested.md",
				expectedPath: "parent/child/nested.md",
				filePath: "parent/child/nested.md",
			};
		});

		return { emptyContent, nested, withContent };
	});

	expect(results.withContent.error).toBeUndefined();
	expect(results.withContent.success).toBe(true);
	expect(results.withContent.fileName).toBe(results.withContent.expectedName);
	expect(results.withContent.filePath).toBe(results.withContent.expectedPath);
	expect(results.withContent.content).toBe(results.withContent.expectedContent);

	expect(results.emptyContent.error).toBeUndefined();
	expect(results.emptyContent.success).toBe(true);
	expect(results.emptyContent.fileName).toBe(results.emptyContent.expectedName);
	expect(results.emptyContent.filePath).toBe(results.emptyContent.expectedPath);
	expect(results.emptyContent.content).toBe(results.emptyContent.expectedContent);

	expect(results.nested.error).toBeUndefined();
	expect(results.nested.success).toBe(true);
	expect(results.nested.fileName).toBe(results.nested.expectedName);
	expect(results.nested.filePath).toBe(results.nested.expectedPath);
	expect(results.nested.content).toBe(results.nested.expectedContent);
};
