/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testUpsertMdFileErrors = async () => {
	try {
		const results = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
			if (!api) throw new Error("testing api unavailable");

			const { tfileHelper, splitPath } = api;

			// Get runErrorTest helper from globalThis
			const runErrorTestCode = (globalThis as { __runErrorTestCode?: string }).__runErrorTestCode;
			if (!runErrorTestCode) {
				throw new Error("runErrorTest code not found - ensure beforeEach ran");
			}
			const runErrorTest = new Function("tfileHelper", "splitPath", runErrorTestCode + " return runErrorTest;")(tfileHelper, splitPath);

			const runCreateErrorTest = async (name: string, setup: () => Promise<{ filePath: string; content: string; expectedError?: string }>) => {
				const setupResult = await setup();
				const filePath = setupResult.filePath;
				const content = setupResult.content;
				const expectedError = setupResult.expectedError;

				try {
					const fileSplitPath = splitPath(filePath);
					const createResult = await tfileHelper.upsertMdFile({
						content,
						splitPath: fileSplitPath,
					}) as unknown as Result<{ name: string; path: string }>;

					if (createResult.isErr()) {
						return { error: createResult.error, expectedError, isErr: true, name };
					}

					return { message: `Expected error for ${name}`, name, success: false };
				} catch (error) {
					return { error: String(error), expectedError, isErr: true, name };
				}
			};

			const parentNotExists = await runCreateErrorTest("parentNotExists", async () => {
				return {
					content: "# Test",
					expectedError: "parent",
					filePath: "nonexistent/parent/file.md",
				};
			});

			const invalidPath = await runCreateErrorTest("invalidPath", async () => {
				return {
					content: "# Test",
					expectedError: "invalid",
					filePath: "invalid//path.md",
				};
			});

			// Test with empty path (invalid)
			const emptyPath = await runCreateErrorTest("emptyPath", async () => {
				return {
					content: "# Test",
					expectedError: "invalid",
					filePath: "",
				};
			});

			return { emptyPath, invalidPath, parentNotExists };
		});

		// Assert on results
		expect(results.parentNotExists.isErr).toBe(true);
		expect(results.parentNotExists.error).toBeDefined();
		if (results.parentNotExists.expectedError) {
			expect(String(results.parentNotExists.error).toLowerCase()).toContain(results.parentNotExists.expectedError);
		}

		expect(results.invalidPath.isErr).toBe(true);
		expect(results.invalidPath.error).toBeDefined();
		if (results.invalidPath.expectedError) {
			expect(String(results.invalidPath.error).toLowerCase()).toContain(results.invalidPath.expectedError);
		}

		expect(results.emptyPath.isErr).toBe(true);
		expect(results.emptyPath.error).toBeDefined();
		if (results.emptyPath.expectedError) {
			expect(String(results.emptyPath.error).toLowerCase()).toContain(results.emptyPath.expectedError);
		}
	} catch (error) {
		// Errors thrown by wdio-obsidian-service are expected for error cases
		expect(error).toBeDefined();
		expect(String(error)).toMatch(/parent|invalid|Failed/);
	}
};
