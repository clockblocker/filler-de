/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type {
	OpenedFileServiceTestingApi,
	Result,
	SplitPathToMdFile,
} from "./utils";

export const testProcessContentHappyPath = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult, makeSplitPath } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: Transform that modifies content
		const filePath = "process-content-test.md";
		const originalContent = "Hello World";
		const transformedContent = "HELLO WORLD";
		try {
			await app.vault.create(filePath, originalContent);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file) throw new Error("Failed to create file");
		await app.workspace.getLeaf(true).openFile(file);

		// Get splitPath for the file
		const pwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<SplitPathToMdFile>;
		if (pwdResult.isErr()) {
			return {
				transform: { error: pwdResult.error, success: false },
			};
		}
		const fileSplitPath = pwdResult.value;

		// Transform: uppercase
		const transformResult = (await openedFileServiceWithResult.processContent({
			splitPath: fileSplitPath,
			transform: (content: string) => content.toUpperCase(),
		})) as unknown as Result<string>;

		if (transformResult.isErr()) {
			return {
				transform: { error: transformResult.error, success: false },
			};
		}

		// Verify content was transformed
		const contentAfter = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;
		if (contentAfter.isErr()) {
			return {
				transform: {
					error: `getContent failed after transform: ${contentAfter.error}`,
					success: false,
					transformError: transformResult.isErr() ? transformResult.error : undefined,
				},
			};
		}
		const transformTest = {
			actualContent: contentAfter.value,
			expectedContent: transformedContent,
			returnedContent: transformResult.value,
			success: true,
		};

		// Test 2: Transform that returns same content (no-op)
		const noOpResult = (await openedFileServiceWithResult.processContent({
			splitPath: fileSplitPath,
			transform: (content: string) => content,
		})) as unknown as Result<string>;

		if (noOpResult.isErr()) {
			return {
				noOp: { error: noOpResult.error, success: false },
				transform: transformTest,
			};
		}

		const contentAfterNoOp = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;
		if (contentAfterNoOp.isErr()) {
			return {
				noOp: {
					error: `getContent failed: ${contentAfterNoOp.error}`,
					success: false,
				},
				transform: transformTest,
			};
		}
		const noOpTest = {
			actualContent: contentAfterNoOp.value,
			expectedContent: transformedContent, // Should remain uppercase
			returnedContent: noOpResult.value,
			success: true,
		};

		// Test 3: Transform with multiline content
		const multilinePath = "process-multiline-test.md";
		const multilineOriginal = "Line 1\nLine 2\nLine 3";
		const multilineExpected = "LINE 1\nLINE 2\nLINE 3";
		try {
			await app.vault.create(multilinePath, multilineOriginal);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const multilineFile = app.vault.getAbstractFileByPath(multilinePath);
		if (!multilineFile) throw new Error("Failed to create multiline file");
		await app.workspace.getLeaf(true).openFile(multilineFile);

		const multilinePwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<SplitPathToMdFile>;
		if (multilinePwdResult.isErr()) {
			return {
				multiline: { error: multilinePwdResult.error, success: false },
				noOp: noOpTest,
				transform: transformTest,
			};
		}
		const multilineSplitPath = multilinePwdResult.value;

		const multilineResult = (await openedFileServiceWithResult.processContent({
			splitPath: multilineSplitPath,
			transform: (content: string) => content.toUpperCase(),
		})) as unknown as Result<string>;

		if (multilineResult.isErr()) {
			return {
				multiline: { error: multilineResult.error, success: false },
				noOp: noOpTest,
				transform: transformTest,
			};
		}

		const multilineContentAfter = (await openedFileServiceWithResult.getContent()) as unknown as Result<string>;
		if (multilineContentAfter.isErr()) {
			return {
				multiline: {
					error: `getContent failed: ${multilineContentAfter.error}`,
					success: false,
				},
				noOp: noOpTest,
				transform: transformTest,
			};
		}
		const multilineTest = {
			actualContent: multilineContentAfter.value,
			expectedContent: multilineExpected,
			returnedContent: multilineResult.value,
			success: true,
		};

		return {
			multiline: multilineTest,
			noOp: noOpTest,
			transform: transformTest,
		};
	});

	expect(results.transform.success).toBe(true);
	expect(results.transform.returnedContent).toBe(results.transform.expectedContent);
	expect(results.transform.actualContent).toBe(results.transform.expectedContent);

	expect(results.noOp.success).toBe(true);
	expect(results.noOp.returnedContent).toBe(results.noOp.expectedContent);
	expect(results.noOp.actualContent).toBe(results.noOp.expectedContent);

	expect(results.multiline.success).toBe(true);
	expect(results.multiline.returnedContent).toBe(results.multiline.expectedContent);
	expect(results.multiline.actualContent).toBe(results.multiline.expectedContent);
};

export const testProcessContentCursorPreservation = async () => {
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

		// Create file with multiple lines
		const filePath = "process-cursor-test.md";
		const originalContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
		try {
			await app.vault.create(filePath, originalContent);
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file) throw new Error("Failed to create file");
		await app.workspace.getLeaf(true).openFile(file);

		// Get view
		const leaves = app.workspace.getLeavesOfType("markdown");
		if (leaves.length === 0) throw new Error("No markdown view available");
		const markdownLeaf = leaves[0];
		const view = markdownLeaf.view;
		if (!view || !view.file) throw new Error("View not available");

		const editor = view.editor;

		// Set cursor to line 2, column 3
		editor.setCursor({ ch: 3, line: 2 });
		const cursorBefore = editor.getCursor();

		// Get splitPath
		const pwdResult = (await openedFileServiceWithResult.pwd()) as unknown as Result<SplitPathToMdFile>;
		if (pwdResult.isErr()) {
			return {
				error: pwdResult.error,
				success: false,
			};
		}
		const fileSplitPath = pwdResult.value;

		// Transform that keeps same line count
		const transformResult = (await openedFileServiceWithResult.processContent({
			splitPath: fileSplitPath,
			transform: (content: string) => content.toUpperCase(),
		})) as unknown as Result<string>;

		if (transformResult.isErr()) {
			return {
				error: transformResult.error,
				success: false,
			};
		}

		// Get cursor after
		const cursorAfter = editor.getCursor();

		return {
			cursorAfter: { ch: cursorAfter.ch, line: cursorAfter.line },
			cursorBefore: { ch: cursorBefore.ch, line: cursorBefore.line },
			success: true,
		};
	});

	expect(results.success).toBe(true);
	// Cursor should be preserved (same line, column may be clamped)
	expect(results.cursorAfter.line).toBe(results.cursorBefore.line);
	expect(results.cursorAfter.ch).toBeGreaterThanOrEqual(0);
	expect(results.cursorAfter.ch).toBeLessThanOrEqual(results.cursorBefore.ch); // May be clamped to line length
};

export const testProcessContentErrorCases = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getOpenedFileServiceTestingApi?.() as
			| OpenedFileServiceTestingApi
			| undefined;
		if (!api) throw new Error("testing api unavailable");

		const { openedFileServiceWithResult, makeSplitPath } = api;
		if (!openedFileServiceWithResult) {
			throw new Error("openedFileServiceWithResult not available");
		}

		// Test 1: No file open
		const leaves = app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			await leaf.detach();
		}

		const fakeSplitPath = splitPath("nonexistent.md") as unknown as SplitPathToMdFile;
		const noFileResult = (await openedFileServiceWithResult.processContent({
			splitPath: fakeSplitPath,
			transform: (content: string) => content,
		})) as unknown as Result<string>;

		// Test 2: File not active (different file open)
		const filePath = "process-error-test.md";
		try {
			await app.vault.create(filePath, "test");
		} catch (e) {
			if (!e.message?.includes("already exists")) throw e;
		}
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file) throw new Error("Failed to create file");
		await app.workspace.getLeaf(true).openFile(file);

		const differentSplitPath = splitPath("different.md") as unknown as SplitPathToMdFile;
		const notActiveResult = (await openedFileServiceWithResult.processContent({
			splitPath: differentSplitPath,
			transform: (content: string) => content,
		})) as unknown as Result<string>;

		return {
			noFile: {
				error: noFileResult.error,
				isErr: noFileResult.isErr(),
				success: noFileResult.isOk(),
			},
			notActive: {
				error: notActiveResult.error,
				isErr: notActiveResult.isErr(),
				success: notActiveResult.isOk(),
			},
		};
	});

	expect(results.noFile.success).toBe(false);
	expect(results.noFile.isErr).toBe(true);
	expect(results.noFile.error).toBeDefined();

	expect(results.notActive.success).toBe(false);
	expect(results.notActive.isErr).toBe(true);
	expect(results.notActive.error).toBeDefined();
};
