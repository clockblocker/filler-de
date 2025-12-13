/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testCreateMdFileIdempotent = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, splitPath } = api;

		const runIdempotentTest = async (name: string, setup: () => Promise<{ filePath: string; content: string }>) => {
			const { filePath, content } = await setup();
			const fileSplitPath = splitPath(filePath);

			// First create
			const createResult1 = await tfileHelper.createMdFile({
				content,
				splitPath: fileSplitPath,
			}) as unknown as Result<{ name: string; path: string }>;

			if (createResult1.isErr()) {
				return { error: createResult1.error, name };
			}

			const firstPath = createResult1.value?.path;
			const firstContent = await app.vault.read(createResult1.value as any);

			// Second create (should return existing)
			const createResult2 = await tfileHelper.createMdFile({
				content: content + " modified",
				splitPath: fileSplitPath,
			}) as unknown as Result<{ name: string; path: string }>;

			if (createResult2.isErr()) {
				return { error: createResult2.error, name };
			}

			const secondPath = createResult2.value?.path;
			const secondContent = await app.vault.read(createResult2.value as any);

			// Verify idempotency: same file, original content preserved
			return {
				firstContent,
				firstPath,
				name,
				pathsMatch: firstPath === secondPath,
				secondContent,
				secondPath,
				success: true,
			};
		};

		const alreadyExists = await runIdempotentTest("alreadyExists", async () => {
			return {
				content: "# Original",
				filePath: "existing.md",
			};
		});

		const multipleTimes = await runIdempotentTest("multipleTimes", async () => {
			return {
				content: "# Test",
				filePath: "multi-create.md",
			};
		});

		// Test creating same file 3 times
		const fileSplitPath = splitPath("multi-create.md");
		const create1 = await tfileHelper.createMdFile({
			content: "# First",
			splitPath: fileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const create2 = await tfileHelper.createMdFile({
			content: "# Second",
			splitPath: fileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const create3 = await tfileHelper.createMdFile({
			content: "# Third",
			splitPath: fileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		const allSame = create1.value?.path === create2.value?.path && create2.value?.path === create3.value?.path;

		return { allSame, alreadyExists, multipleTimes };
	});

	expect(results.alreadyExists.error).toBeUndefined();
	expect(results.alreadyExists.success).toBe(true);
	expect(results.alreadyExists.pathsMatch).toBe(true);
	expect(results.alreadyExists.firstPath).toBe(results.alreadyExists.secondPath);
	// Original content should be preserved (idempotent, doesn't overwrite)
	expect(results.alreadyExists.firstContent).toBe("# Original");

	expect(results.multipleTimes.error).toBeUndefined();
	expect(results.multipleTimes.success).toBe(true);
	expect(results.multipleTimes.pathsMatch).toBe(true);

	expect(results.allSame).toBe(true);
};
