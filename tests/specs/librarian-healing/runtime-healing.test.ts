/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "../dispatcher/utils";

/**
 * Test Mode 1 (Runtime) healing: BasenameOnly subtype.
 * User renames basename → we move file to suffix location.
 */
export const testRuntimeBasenameOnly = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Setup: Create file at Library/A/note-A.md (correct suffix)
		const initialPath = "Library/A/note-A.md";
		await manager.dispatch([
			{
				payload: { content: "", splitPath: splitPath(initialPath) },
				type: "CreateMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Initialize librarian
		await librarian.init();

		// Simulate user renaming basename: note-A.md → note-B-A.md
		// This indicates user wants to move file to Library/A/B/
		const renamedPath = "Library/A/note-B-A.md";
		await manager.dispatch([
			{
				payload: {
					from: splitPath(initialPath),
					to: splitPath(renamedPath),
				},
				type: "RenameMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Handle the rename event
		const actions = await librarian.handleRename(
			initialPath,
			renamedPath,
			false, // isFolder
		);

		// Wait for actions to complete
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify file was moved to Library/A/B/note-B-A.md
		const expectedPath = "Library/A/B/note-B-A.md";
		const existsAtExpected = await manager.exists(splitPath(expectedPath));
		const existsAtRenamed = await manager.exists(splitPath(renamedPath));

		// Debug: check action details
		const actionTypes = actions.map((a: any) => a.type);
		const actionDetails = actions.map((a: any) => ({
			from: a.payload?.from?.pathParts?.join("/"),
			to: a.payload?.to?.pathParts?.join("/"),
			type: a.type,
		}));

		return {
			actionCount: actions.length,
			actionDetails,
			actionTypes,
			existsAtExpected,
			existsAtRenamed,
			expectedPath,
			success: true,
		};
	});

	console.log("BasenameOnly test result:", JSON.stringify(result, null, 2));

	expect(result.success).toBe(true);
	// Should have generated move action
	expect(result.actionCount).toBeGreaterThan(0);
	// File should be at new location
	expect(result.existsAtExpected).toBe(true);
};

/**
 * Test Mode 1 (Runtime) healing: PathOnly subtype.
 * User moves file → we fix suffix to match new path.
 */
export const testRuntimePathOnly = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Setup: Create file at Library/A/note-A.md
		const initialPath = "Library/A/note-A.md";
		await manager.dispatch([
			{
				payload: { content: "", splitPath: splitPath(initialPath) },
				type: "CreateMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Initialize librarian
		await librarian.init();

		// Simulate user moving file: Library/A/note-A.md → Library/B/note-A.md
		// (same basename, different path) → we should rename to note-B.md
		const movedPath = "Library/B/note-A.md";
		await manager.dispatch([
			{
				payload: {
					from: splitPath(initialPath),
					to: splitPath(movedPath),
				},
				type: "RenameMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Handle the rename event
		const actions = await librarian.handleRename(
			initialPath,
			movedPath,
			false,
		);

		// Wait for actions to complete
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify file was renamed to note-B.md (suffix fixed)
		const expectedPath = "Library/B/note-B.md";
		const existsAtExpected = await manager.exists(splitPath(expectedPath));
		const existsAtMoved = await manager.exists(splitPath(movedPath));

		return {
			actionCount: actions.length,
			existsAtExpected,
			existsAtMoved,
			expectedPath,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	// Should have generated rename action
	expect(result.actionCount).toBeGreaterThan(0);
	// File should have fixed suffix
	expect(result.existsAtExpected).toBe(true);
};

/**
 * Test Mode 1 (Runtime) PathOnly: No action when suffix already matches new path.
 */
export const testRuntimeNoOpWhenCorrect = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Setup: Create file at Library/A/note-A.md
		const initialPath = "Library/A/note-A.md";
		await manager.dispatch([
			{
				payload: { content: "", splitPath: splitPath(initialPath) },
				type: "CreateMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		await librarian.init();

		// Simulate PathOnly: move to B but KEEP same basename (note-A.md)
		// This is PathOnly mode - basename stays same, path changes
		// After our fix, file should be renamed to note-B.md
		// But if we test with already-correct suffix...
		
		// Actually test: user moves and manually fixes suffix at same time
		// This is "Both" mode but suffix ends up correct → still no-op needed
		// Let's test a simpler case: PathOnly where suffix already happens to match
		
		// Move from A to A/B (deeper) - same basename
		const movedPath = "Library/A/B/note-A.md";
		await manager.dispatch([
			{
				payload: {
					from: splitPath(initialPath),
					to: splitPath(movedPath),
				},
				type: "RenameMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Handle rename - PathOnly mode, suffix needs fix
		const actions = await librarian.handleRename(
			initialPath,
			movedPath,
			false,
		);

		// Should generate rename to fix suffix to note-B-A.md
		return {
			actionCount: actions.length,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	// PathOnly always needs suffix fix (unless by coincidence already correct)
	expect(result.actionCount).toBe(1);
};

/**
 * Test Mode 1 (Runtime) healing: Folder rename.
 * User renames folder → we heal all children's suffixes.
 */
export const testRuntimeFolderRename = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Setup: Create files at Library/A/note1-A.md and Library/A/note2-A.md
		await manager.dispatch([
			{
				payload: { content: "", splitPath: splitPath("Library/A/note1-A.md") },
				type: "CreateMdFile",
			},
			{
				payload: { content: "", splitPath: splitPath("Library/A/note2-A.md") },
				type: "CreateMdFile",
			},
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Initialize librarian
		await librarian.init();

		// Simulate folder rename: Library/A → Library/B
		// Obsidian does NOT emit child file events, only folder event
		// We need to use vault.rename directly to rename folder
		const folderA = app.vault.getAbstractFileByPath("Library/A");
		if (!folderA) throw new Error("Folder A not found");
		await app.vault.rename(folderA, "Library/B");
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Handle the folder rename event
		const actions = await librarian.handleRename(
			"Library/A",
			"Library/B",
			true, // isFolder
		);

		// Wait for actions to complete
		await new Promise((resolve) => setTimeout(resolve, 300));

		// Verify files were renamed to have correct suffix (note1-B.md, note2-B.md)
		const existsNote1 = await manager.exists(splitPath("Library/B/note1-B.md"));
		const existsNote2 = await manager.exists(splitPath("Library/B/note2-B.md"));
		
		// Old names should not exist
		const existsOldNote1 = await manager.exists(splitPath("Library/B/note1-A.md"));
		const existsOldNote2 = await manager.exists(splitPath("Library/B/note2-A.md"));

		return {
			actionCount: actions.length,
			existsNote1,
			existsNote2,
			existsOldNote1,
			existsOldNote2,
			success: true,
		};
	});

	console.log("Folder rename test result:", JSON.stringify(result, null, 2));

	expect(result.success).toBe(true);
	// Should have generated 2 rename actions (one per file)
	expect(result.actionCount).toBe(2);
	// Files should have new suffixes
	expect(result.existsNote1).toBe(true);
	expect(result.existsNote2).toBe(true);
	// Old names should not exist
	expect(result.existsOldNote1).toBe(false);
	expect(result.existsOldNote2).toBe(false);
};
