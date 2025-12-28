/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "../dispatcher/utils";

/**
 * Test Mode 3 (DragIn) healing: File drag from outside library.
 * Suffix wins → move file to suffix location.
 */
export const testDragInFileMoveToSuffix = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, makeSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();

		// Create Library folder first
		await manager.dispatch([
			{
				payload: {
					makeSplitPath: makeSplitPath("Library"),
				},
				type: "CreateFolder",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Setup: Create file outside library
		const outsidePath = "outside/note-B-A.md";
		await manager.dispatch([
			{
				payload: { content: "", makeSplitPath: makeSplitPath(outsidePath) },
				type: "UpsertMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		await librarian.init();

		// Simulate user dragging file to Library root
		const droppedPath = "Library/note-B-A.md";
		await manager.dispatch([
			{
				payload: {
					from: makeSplitPath(outsidePath),
					to: makeSplitPath(droppedPath),
				},
				type: "RenameMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Handle the drag-in event
		const actions = await librarian.handleRename(
			outsidePath,
			droppedPath,
			false,
		);

		// Wait for actions
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify file was moved to suffix location: Library/A/B/note-B-A.md
		const expectedPath = "Library/A/B/note-B-A.md";
		const existsAtExpected = await manager.exists(makeSplitPath(expectedPath));

		return {
			actionCount: actions.length,
			existsAtExpected,
			expectedPath,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	// Should have generated actions (folder creates + move)
	expect(result.actionCount).toBeGreaterThan(0);
	// File should be at suffix location
	expect(result.existsAtExpected).toBe(true);
};

/**
 * Test Mode 3 (DragIn): File without suffix stays at root.
 */
export const testDragInFileNoSuffixStaysAtRoot = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, makeSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];

		// Create Library folder first
		await manager.dispatch([
			{
				payload: {
					makeSplitPath: makeSplitPath("Library"),
				},
				type: "CreateFolder",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Setup: Create file outside library with no suffix
		const outsidePath = "outside/note.md";
		await manager.dispatch([
			{
				payload: { content: "", makeSplitPath: makeSplitPath(outsidePath) },
				type: "UpsertMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		await librarian.init();

		// Simulate drag to Library root
		const droppedPath = "Library/note.md";
		await manager.dispatch([
			{
				payload: {
					from: makeSplitPath(outsidePath),
					to: makeSplitPath(droppedPath),
				},
				type: "RenameMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Handle drag-in - no suffix means stays at root
		const actions = await librarian.handleRename(
			outsidePath,
			droppedPath,
			false,
		);

		// File should stay where it was dropped
		const existsAtDropped = await manager.exists(makeSplitPath(droppedPath));

		return {
			actionCount: actions.length,
			existsAtDropped,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	// No actions - file is at correct location (root, no suffix)
	expect(result.actionCount).toBe(0);
	expect(result.existsAtDropped).toBe(true);
};

/**
 * Test Mode 3 (DragIn): File moved out of library is ignored.
 */
export const testMoveOutOfLibraryIgnored = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, makeSplitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Setup: Create file inside library
		const insidePath = "Library/A/note-A.md";
		await manager.dispatch([
			{
				payload: { content: "", makeSplitPath: makeSplitPath(insidePath) },
				type: "UpsertMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		await librarian.init();

		// Simulate moving file OUT of library
		const outsidePath = "outside/note-A.md";
		await manager.dispatch([
			{
				payload: {
					from: makeSplitPath(insidePath),
					to: makeSplitPath(outsidePath),
				},
				type: "RenameMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Handle - should be ignored (not our concern)
		const actions = await librarian.handleRename(
			insidePath,
			outsidePath,
			false,
		);

		return {
			actionCount: actions.length,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	// No actions - file moved out of library
	expect(result.actionCount).toBe(0);
};
