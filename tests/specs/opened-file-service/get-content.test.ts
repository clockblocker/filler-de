/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type {
	OpenedFileServiceTestingApi,
	Result,
} from "./utils";

export const testGetContentHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: File with content
		const withContentPath = "get-content-with.md";
		const withContentText = "# Test Content\n\nThis is a test file.";
		try {
			await app.vault.create(withContentPath, withContentText);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const withContentFile = app.vault.getAbstractFileByPath(withContentPath);
		if (!withContentFile) throw new Error("Failed to create file with content");
		await app.workspace.getLeaf(true).openFile(withContentFile);

		const withContentResult = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;

		if (withContentResult.isErr()) {
			return {
				withContent: { error: withContentResult.error, success: false },
			};
		}

		const withContentTest = {
			content: withContentResult.value,
			expectedContent: withContentText,
			success: true,
		};

		// Test 2: File with empty content
		const emptyContentPath = "get-content-empty.md";
		try {
			await app.vault.create(emptyContentPath, "");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const emptyContentFile = app.vault.getAbstractFileByPath(emptyContentPath);
		if (!emptyContentFile) throw new Error("Failed to create empty file");
		await app.workspace.getLeaf(true).openFile(emptyContentFile);

		const emptyContentResult = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;

		if (emptyContentResult.isErr()) {
			return {
				emptyContent: { error: emptyContentResult.error, success: false },
				withContent: withContentTest,
			};
		}

		const emptyContentTest = {
			content: emptyContentResult.value,
			expectedContent: "",
			success: true,
		};

		// Test 3: File with multiline content
		const multilineContentPath = "get-content-multiline.md";
		const multilineContentText = "Line 1\nLine 2\nLine 3\n\nParagraph 2\n\nParagraph 3";
		try {
			await app.vault.create(multilineContentPath, multilineContentText);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const multilineContentFile = app.vault.getAbstractFileByPath(multilineContentPath);
		if (!multilineContentFile) throw new Error("Failed to create multiline file");
		await app.workspace.getLeaf(true).openFile(multilineContentFile);

		const multilineContentResult = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;

		if (multilineContentResult.isErr()) {
			return {
				emptyContent: emptyContentTest,
				multilineContent: { error: multilineContentResult.error, success: false },
				withContent: withContentTest,
			};
		}

		const multilineContentTest = {
			content: multilineContentResult.value,
			expectedContent: multilineContentText,
			success: true,
		};

		return {
			emptyContent: emptyContentTest,
			multilineContent: multilineContentTest,
			withContent: withContentTest,
		};
	});

	expect(results.withContent.success).toBe(true);
	expect(results.withContent.content).toBe(results.withContent.expectedContent);

	expect(results.emptyContent.success).toBe(true);
	expect(results.emptyContent.content).toBe(results.emptyContent.expectedContent);

	expect(results.multilineContent.success).toBe(true);
	expect(results.multilineContent.content).toBe(results.multilineContent.expectedContent);
};

export const testGetContentErrorCases = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Close any open files by detaching all leaves
		const leaves = app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			await leaf.detach();
		}

		// Test: No file open
		const noFileResult = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;

		return {
			noFile: {
				error: noFileResult.error,
				isErr: noFileResult.isErr(),
				success: noFileResult.isOk(),
			},
		};
	});

	expect(results.noFile.success).toBe(false);
	expect(results.noFile.isErr).toBe(true);
	expect(results.noFile.error).toBeDefined();
};
