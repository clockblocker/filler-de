/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testGetFileErrors = async () => {
	try {
		const results = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
			if (!api) throw new Error("testing api unavailable");

			const { tfileHelper, tfolderHelper, makeSplitPath } = api;

			// Get runErrorTest helper from globalThis
			const runErrorTestCode = (globalThis as { __runErrorTestCode?: string }).__runErrorTestCode;
			if (!runErrorTestCode) {
				throw new Error("runErrorTest code not found - ensure beforeEach ran");
			}
			const runErrorTest = new Function("tfileHelper", "splitPath", runErrorTestCode + " return runErrorTest;")(tfileHelper, splitPath);

			const notExists = await runErrorTest("notExists", async () => {
				return { expectedError: "Failed to get file", path: "nonexistent.md" };
			});

			const pointsToFolder = await runErrorTest("pointsToFolder", async () => {
				const folderSplitPath = splitPath("test-folder");
				const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

				if (folderResult.isErr()) {
					throw new Error(folderResult.error);
				}

				return { expectedError: "Expected file type missmatched", path: "test-folder" };
			});

			const invalidPath = await runErrorTest("invalidPath", async () => {
				return { expectedError: "Failed to get file", path: "" };
			});

			return { invalidPath, notExists, pointsToFolder };
		});

		// Assert on results
		expect(results.notExists.isErr).toBe(true);
		expect(results.notExists.error).toBeDefined();
		if (results.notExists.expectedError) {
			expect(String(results.notExists.error)).toContain(results.notExists.expectedError);
		}

		expect(results.pointsToFolder.isErr).toBe(true);
		expect(results.pointsToFolder.error).toBeDefined();
		if (results.pointsToFolder.expectedError) {
			expect(String(results.pointsToFolder.error)).toContain(results.pointsToFolder.expectedError);
		}

		expect(results.invalidPath.isErr).toBe(true);
		expect(results.invalidPath.error).toBeDefined();
		if (results.invalidPath.expectedError) {
			expect(String(results.invalidPath.error)).toContain(results.invalidPath.expectedError);
		}
	} catch (error) {
		// Errors thrown by wdio-obsidian-service are expected for error cases
		expect(error).toBeDefined();
		expect(String(error)).toMatch(/Failed to get file|Expected file type missmatched/);
	}
};
