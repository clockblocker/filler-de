/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testGetFileNotExists = async () => {
	try {
		const result = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
			if (!api) throw new Error("testing api unavailable");

			const { tfileHelper, splitPath } = api;

			const fileSplitPath = splitPath("nonexistent.md");
			const getResult = await tfileHelper.getFile(fileSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (getResult.isErr()) {
				return { error: getResult.error, isErr: true };
			}

			return { message: "Expected error", success: false };
		});

		// If we get here, check if result indicates error
		if (result && typeof result === "object" && "isErr" in result && result.isErr) {
			expect(result.isErr).toBe(true);
			expect(result.error).toBeDefined();
		} else {
			throw new Error("Expected error but got success");
		}
	} catch (error) {
		// Errors thrown by wdio-obsidian-service are expected for error cases
		expect(error).toBeDefined();
		expect(String(error)).toContain("Failed to get file");
	}
};

export const testGetFilePointsToFolder = async () => {
	try {
		const result = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
			if (!api) throw new Error("testing api unavailable");

			const { tfileHelper, tfolderHelper, splitPath } = api;

			// Create folder first
			const folderSplitPath = splitPath("test-folder");
			const folderResult = await tfolderHelper.createFolder(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (folderResult.isErr()) {
				return { error: folderResult.error };
			}

			// Try to get folder as file (should error)
			const getResult = await tfileHelper.getFile(folderSplitPath) as unknown as Result<{ name: string; path: string }>;

			if (getResult.isErr()) {
				return { error: getResult.error, isErr: true };
			}

			return { message: "Expected error for folder path", success: false };
		});

		// If we get here, check if result indicates error
		if (result && typeof result === "object" && "isErr" in result && result.isErr) {
			expect(result.isErr).toBe(true);
			expect(result.error).toBeDefined();
		} else {
			throw new Error("Expected error but got success");
		}
	} catch (error) {
		// Errors thrown by wdio-obsidian-service are expected for error cases
		expect(error).toBeDefined();
		expect(String(error)).toContain("Expected file type missmatched");
	}
};

export const testGetFileInvalidPath = async () => {
	try {
		const result = await browser.executeObsidian(async ({ app }: any) => {
			const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
			if (!api) throw new Error("testing api unavailable");

			const { tfileHelper, splitPath } = api;

			// Try with empty path
			const emptySplitPath = splitPath("");
			const getResult = await tfileHelper.getFile(emptySplitPath) as unknown as Result<{ name: string; path: string }>;

			if (getResult.isErr()) {
				return { error: getResult.error, isErr: true };
			}

			return { message: "Expected error for empty path", success: false };
		});

		// If we get here, check if result indicates error
		if (result && typeof result === "object" && "isErr" in result && result.isErr) {
			expect(result.isErr).toBe(true);
			expect(result.error).toBeDefined();
		} else {
			throw new Error("Expected error but got success");
		}
	} catch (error) {
		// Errors thrown by wdio-obsidian-service are expected for error cases
		expect(error).toBeDefined();
		expect(String(error)).toContain("Failed to get file");
	}
};
