/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type {
	OpenedFileServiceTestingApi,
	Result,
} from "./utils";

export const testReplaceAllContentHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult, splitPath } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: Replace with new content
		const filePath = "replace-all-content-test.md";
		const originalContent = "Original content\nLine 2\nLine 3";
		const newContent = "New content\nReplaced line";
		try {
			await app.vault.create(filePath, originalContent);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file) throw new Error("Failed to create file");
		await app.workspace.getLeaf(true).openFile(file);

		// Wait for view to be ready
		await new Promise((resolve) => setTimeout(resolve, 100));

		const replaceResult = (await openedFileServiceWithResult.replaceAllContentInOpenedFile(
			newContent,
		)) as unknown as Result<string>;

		if (replaceResult.isErr()) {
			return {
				replace: {
					error: replaceResult.error,
					success: false,
				},
			};
		}

		// Wait a bit for content to settle
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Wait a bit longer for content to settle
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify content was updated
		const contentAfter = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;
		if (contentAfter.isErr()) {
			return {
				replace: {
					error: `getContent failed after replace: ${contentAfter.error}`,
					success: false,
				},
			};
		}
		const replaceTest = {
			actualContent: contentAfter.value,
			expectedContent: newContent,
			returnedContent: replaceResult.value,
			success: true,
		};

		// Test 2: Replace with empty content
		const emptyContent = "";
		const emptyResult = (await openedFileServiceWithResult.replaceAllContentInOpenedFile(
			emptyContent,
		)) as unknown as Result<string>;

		if (emptyResult.isErr()) {
			return {
				empty: { error: emptyResult.error, success: false },
				replace: replaceTest,
			};
		}

		const contentAfterEmpty = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;
		if (contentAfterEmpty.isErr()) {
			return {
				empty: {
					error: `getContent failed: ${contentAfterEmpty.error}`,
					success: false,
				},
				replace: replaceTest,
			};
		}
		const emptyTest = {
			actualContent: contentAfterEmpty.value,
			expectedContent: emptyContent,
			returnedContent: emptyResult.value,
			success: true,
		};

		// Test 3: Replace with same content (no-op)
		const sameResult = (await openedFileServiceWithResult.replaceAllContentInOpenedFile(
			emptyContent,
		)) as unknown as Result<string>;

		if (sameResult.isErr()) {
			return {
				empty: emptyTest,
				replace: replaceTest,
				same: { error: sameResult.error, success: false },
			};
		}

		const contentAfterSame = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;
		if (contentAfterSame.isErr()) {
			return {
				empty: emptyTest,
				replace: replaceTest,
				same: {
					error: `getContent failed: ${contentAfterSame.error}`,
					success: false,
				},
			};
		}
		const sameTest = {
			actualContent: contentAfterSame.value,
			expectedContent: emptyContent,
			returnedContent: sameResult.value,
			success: true,
		};

		return {
			empty: emptyTest,
			replace: replaceTest,
			same: sameTest,
		};
	});

	expect(results.replace.success).toBe(true);
	if (results.replace.success) {
		const replace = results.replace as {
			actualContent: string;
			expectedContent: string;
			returnedContent: string;
			success: true;
		};
		expect(replace.returnedContent).toBe(replace.expectedContent);
		expect(replace.actualContent).toBe(replace.expectedContent);
	}

	if (!results.empty) throw new Error("empty test result missing");
	expect(results.empty.success).toBe(true);
	if (results.empty.success) {
		const empty = results.empty as {
			actualContent: string;
			expectedContent: string;
			returnedContent: string;
			success: true;
		};
		expect(empty.returnedContent).toBe(empty.expectedContent);
		expect(empty.actualContent).toBe(empty.expectedContent);
	}

	if (!results.same) throw new Error("same test result missing");
	expect(results.same.success).toBe(true);
	if (results.same.success) {
		const same = results.same as {
			actualContent: string;
			expectedContent: string;
			returnedContent: string;
			success: true;
		};
		expect(same.returnedContent).toBe(same.expectedContent);
	}
};

export const testReplaceAllContentScrollPreservation = async () => {
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

		// Create file with many lines
		const filePath = "replace-scroll-test.md";
		const originalContent = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join("\n");
		try {
			await app.vault.create(filePath, originalContent);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file) throw new Error("Failed to create file");
		const testLeaf = app.workspace.getLeaf(true);
		await testLeaf.openFile(file);

		// Get view
		const leaves = app.workspace.getLeavesOfType("markdown");
		if (leaves.length === 0) throw new Error("No markdown view available");
		const markdownLeaf = leaves[0];
		const view = markdownLeaf.view;
		if (!view || !view.file) throw new Error("View not available");

		const editor = view.editor;

		// Set cursor to a specific line and get its content
		const targetLine = 20;
		editor.setCursor({ ch: 0, line: targetLine });
		const targetLineContent = editor.getLine(targetLine) ?? "";

		// Replace with new content that includes the target line
		const newContent = `New Line 1\nNew Line 2\n${targetLineContent}\nNew Line 4\nNew Line 5`;
		const replaceResult = (await openedFileServiceWithResult.replaceAllContentInOpenedFile(
			newContent,
		)) as unknown as Result<string>;

		if (replaceResult.isErr()) {
			return {
				error: replaceResult.error,
				success: false,
			};
		}

		// Verify content was replaced
		const contentAfter = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;
		if (contentAfter.isErr()) {
			return {
				error: `getContent failed: ${contentAfter.error}`,
				success: false,
			};
		}

		// Check cursor position - should be preserved or adjusted appropriately
		const cursorAfter = editor.getCursor();
		const newLines = newContent.split("\n");
		const foundIndex = newLines.indexOf(targetLineContent);

		return {
			contentMatches: contentAfter.value === newContent,
			cursorLine: cursorAfter.line,
			expectedLineIndex: foundIndex !== -1 ? foundIndex : Math.min(targetLine, newLines.length - 1),
			foundIndex,
			success: true,
			targetLineContent,
		};
	});

	expect(results.success).toBe(true);
	expect(results.contentMatches).toBe(true);
	// Cursor should be at a valid line index
	expect(results.cursorLine).toBeGreaterThanOrEqual(0);
	expect(results.cursorLine).toBeLessThan(5); // New content has 5 lines
};

export const testReplaceAllContentErrorCases = async () => {
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

		// Close any open files
		const leaves = app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			await leaf.detach();
		}

		// Test: No file open
		const noFileResult = (await openedFileServiceWithResult.replaceAllContentInOpenedFile(
			"test",
		)) as unknown as Result<string>;

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
