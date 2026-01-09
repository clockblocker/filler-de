/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import { waitForFile, waitForFileGone } from "../../helpers/polling";

// Shorter timeouts for codex operations (they should be fast after healing)
const CODEX_WAIT = { intervalOffset: 0, timeoutOffset: 1000 };
const CODEX_GONE_WAIT = { intervalOffset: -300, timeoutOffset: 500 };

// ─── File Rename Tests ───

/**
 * Test: Renaming a file updates the codex content.
 * 
 * Scenario:
 * - Rename Library/A/B/Note-B-A.md → Library/A/B/Renamed-B-A.md
 * - Codex Library/A/B/__-B-A.md should update to reference new file
 */
export async function testCodexUpdatesOnFileRename(): Promise<void> {
	const oldPath = "Library/A/B/Note-B-A.md";
	const newPath = "Library/A/B/Renamed-B-A.md";
	const codexPath = "Library/A/B/__-B-A.md";

	// Rename file
	await browser.executeObsidian(async ({ app }, { oldP, newP }) => {
		const file = app.vault.getAbstractFileByPath(oldP);
		if (file) await app.vault.rename(file, newP);
	}, { newP: newPath, oldP: oldPath });

	// Wait for rename to complete and codex to update
	await new Promise((r) => setTimeout(r, 2000));

	// Renamed file should exist
	const renamed = await waitForFile(newPath, CODEX_WAIT);
	expect(renamed).toBe(true);

	// Codex should still exist
	const codexExists = await waitForFile(codexPath, CODEX_WAIT);
	expect(codexExists).toBe(true);

	// Codex content should reference new filename
	const codexContent = await browser.executeObsidian(async ({ app }, path) => {
		const file = app.vault.getAbstractFileByPath(path);
		if (file && "extension" in file && file.extension === "md") {
			return await app.vault.read(file as any);
		}
		return null;
	}, codexPath);

	// Codex should reference new filename (link target contains full basename)
	expect(codexContent).toContain("[[Renamed-B-A|Renamed]]");
	expect(codexContent).not.toContain("[[Note-B-A|Note]]");
}

/**
 * Test: Renaming a file that causes move updates codexes.
 * 
 * Scenario:
 * - Rename Library/A/B/C/Note-C-B-A.md → Library/A/B/C/Note-X-Y.md (suffix change)
 * - Old codex should update, new codex created at new location
 */
export async function testCodexUpdatesOnFileRenameWithMove(): Promise<void> {
	const oldPath = "Library/A/B/C/Note-C-B-A.md";
	const renamedPath = "Library/A/B/C/Note-X-Y.md"; // User renames
	const expectedPath = "Library/Y/X/Note-X-Y.md"; // Healed location
	
	const oldCodexPath = "Library/A/B/C/__-C-B-A.md";
	const newCodexPathY = "Library/Y/__-Y.md";
	const newCodexPathX = "Library/Y/X/__-X-Y.md";

	// Rename file (suffix change triggers move)
	await browser.executeObsidian(async ({ app }, { oldP, newP }) => {
		const file = app.vault.getAbstractFileByPath(oldP);
		if (file) await app.vault.rename(file, newP);
	}, { newP: renamedPath, oldP: oldPath });

	// File should be healed to new location
	const healed = await waitForFile(expectedPath, CODEX_WAIT);
	expect(healed).toBe(true);

	// New codexes should exist
	const newCodexY = await waitForFile(newCodexPathY, CODEX_WAIT);
	const newCodexX = await waitForFile(newCodexPathX, CODEX_WAIT);
	expect(newCodexY).toBe(true);
	expect(newCodexX).toBe(true);
}

// ─── Folder Rename Tests ───

/**
 * Test: Renaming a folder updates codex naming.
 * 
 * Scenario:
 * - Rename Library/F1 → Library/Renamed
 * - Old codex Library/F1/__-F1.md should become Library/Renamed/__-Renamed.md
 */
export async function testCodexRenamedOnFolderRename(): Promise<void> {
	const oldFolderPath = "Library/F1";
	const newFolderPath = "Library/Renamed";
	const oldCodexPath = "Library/F1/__-F1.md";
	const newCodexPath = "Library/Renamed/__-Renamed.md";

	// Debug: check if old codex exists before rename
	const oldCodexExistsBefore = await browser.executeObsidian(async ({ app }, path) => {
		return !!app.vault.getAbstractFileByPath(path);
	}, oldCodexPath);
	console.log("Old codex exists before rename:", oldCodexExistsBefore);

	// Rename folder
	await browser.executeObsidian(async ({ app }, { oldP, newP }) => {
		const folder = app.vault.getAbstractFileByPath(oldP);
		if (folder) await app.vault.rename(folder, newP);
	}, { newP: newFolderPath, oldP: oldFolderPath });

	// Wait for processing
	await new Promise((r) => setTimeout(r, 3000));

	// Debug: check what files exist
	const filesInRenamed = await browser.executeObsidian(async ({ app }, folderPath) => {
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (!folder || !("children" in folder)) return [];
		return (folder as any).children.map((f: any) => f.path);
	}, newFolderPath);
	console.log("Files in renamed folder:", filesInRenamed);

	// Old codex should be gone (folder was renamed, so old path doesn't exist)
	const oldGone = await waitForFileGone(oldCodexPath, CODEX_GONE_WAIT);
	expect(oldGone).toBe(true);

	// New codex should exist
	const newExists = await waitForFile(newCodexPath, CODEX_WAIT);
	expect(newExists).toBe(true);
}

/**
 * Test: Renaming nested folder updates all descendant codexes.
 * 
 * Scenario:
 * - Rename Library/grandpa → Library/elder
 * - All descendant codexes should update their suffix
 */
export async function testCodexRenamedOnNestedFolderRename(): Promise<void> {
	const oldFolderPath = "Library/grandpa";
	const newFolderPath = "Library/elder";
	
	// Old codex paths
	const oldGrandpaCodex = "Library/grandpa/__-grandpa.md";
	const oldFatherCodex = "Library/grandpa/father/__-father-grandpa.md";
	const oldKidCodex = "Library/grandpa/father/kid/__-kid-father-grandpa.md";
	
	// New codex paths
	const newElderCodex = "Library/elder/__-elder.md";
	const newFatherCodex = "Library/elder/father/__-father-elder.md";
	const newKidCodex = "Library/elder/father/kid/__-kid-father-elder.md";

	// Debug: check if old codexes exist before rename
	const oldCodexesBefore = await browser.executeObsidian(async ({ app }, paths) => {
		return paths.map(p => ({ exists: !!app.vault.getAbstractFileByPath(p), path: p }));
	}, [oldGrandpaCodex, oldFatherCodex, oldKidCodex]);
	console.log("Old codexes before rename:", oldCodexesBefore);

	// Rename folder
	await browser.executeObsidian(async ({ app }, { oldP, newP }) => {
		const folder = app.vault.getAbstractFileByPath(oldP);
		if (folder) await app.vault.rename(folder, newP);
	}, { newP: newFolderPath, oldP: oldFolderPath });

	// Wait for processing
	await new Promise((r) => setTimeout(r, 5000));

	// Debug: list all files in elder folder recursively
	const allFiles = await browser.executeObsidian(async ({ app }, folderPath) => {
		const result: string[] = [];
		const recurse = (path: string) => {
			const folder = app.vault.getAbstractFileByPath(path);
			if (!folder || !("children" in folder)) return;
			for (const child of (folder as any).children) {
				result.push(child.path);
				if ("children" in child) recurse(child.path);
			}
		};
		recurse(folderPath);
		return result;
	}, newFolderPath);
	console.log("All files in elder folder:", allFiles);

	// Old codexes should be gone (folder was renamed)
	const oldGrandpaGone = await waitForFileGone(oldGrandpaCodex, CODEX_GONE_WAIT);
	const oldFatherGone = await waitForFileGone(oldFatherCodex, CODEX_GONE_WAIT);
	const oldKidGone = await waitForFileGone(oldKidCodex, CODEX_GONE_WAIT);
	
	console.log("Old codexes gone:", { oldFatherGone, oldGrandpaGone, oldKidGone });
	
	expect(oldGrandpaGone).toBe(true);
	expect(oldFatherGone).toBe(true);
	expect(oldKidGone).toBe(true);

	// New codexes should exist
	const newElderExists = await waitForFile(newElderCodex, CODEX_WAIT);
	const newFatherExists = await waitForFile(newFatherCodex, CODEX_WAIT);
	const newKidExists = await waitForFile(newKidCodex, CODEX_WAIT);
	
	console.log("New codexes exist:", { newElderExists, newFatherExists, newKidExists });
	
	expect(newElderExists).toBe(true);
	expect(newFatherExists).toBe(true);
	expect(newKidExists).toBe(true);
}

// ─── File Move (Drag) Tests ───

/**
 * Test: Moving a file to different folder updates codexes.
 * 
 * Scenario:
 * - Move Library/F3/F4/Note-F4-F3.md → Library/A/Note-F4-F3.md (drag)
 * - File gets healed to Library/A/Note-A.md
 * - Old codex F4 should be cleaned if empty, new codex A updated
 */
export async function testCodexUpdatesOnFileMove(): Promise<void> {
	const oldPath = "Library/F3/F4/Note-F4-F3.md";
	const draggedPath = "Library/A/Note-F4-F3.md";
	const healedPath = "Library/A/Note-A.md"; // PathKing heals suffix
	
	const oldCodexF4 = "Library/F3/F4/__-F4-F3.md";
	const codexA = "Library/A/__-A.md";

	// Move file (simulate drag)
	await browser.executeObsidian(async ({ app }, { oldP, newP }) => {
		const file = app.vault.getAbstractFileByPath(oldP);
		if (file) await app.vault.rename(file, newP);
	}, { newP: draggedPath, oldP: oldPath });

	// File should be healed
	const healed = await waitForFile(healedPath, CODEX_WAIT);
	expect(healed).toBe(true);

	// Codex A should exist and contain the file
	const codexAExists = await waitForFile(codexA, CODEX_WAIT);
	expect(codexAExists).toBe(true);

	const codexContent = await browser.executeObsidian(async ({ app }, path) => {
		const file = app.vault.getAbstractFileByPath(path);
		if (file && "extension" in file && file.extension === "md") {
			return await app.vault.read(file as any);
		}
		return null;
	}, codexA);

	expect(codexContent).toContain("Note-A");
}

// ─── Folder Move (Drag) Tests ───

/**
 * Test: Moving a folder updates all codexes.
 * 
 * Scenario:
 * - Move Library/F3 → Library/A/F3 (drag folder into A)
 * - Codexes should update: F3 codex suffix changes, files inside healed
 */
export async function testCodexUpdatesOnFolderMove(): Promise<void> {
	// First check what exists
	const folderPath = "Library/F3";
	const newFolderPath = "Library/A/F3";
	
	const oldCodexF3 = "Library/F3/__-F3.md";
	const newCodexF3 = "Library/A/F3/__-F3-A.md";

	// Move folder
	await browser.executeObsidian(async ({ app }, { oldP, newP }) => {
		const folder = app.vault.getAbstractFileByPath(oldP);
		if (folder) await app.vault.rename(folder, newP);
	}, { newP: newFolderPath, oldP: folderPath });

	// Old codex should be gone
	const oldGone = await waitForFileGone(oldCodexF3, CODEX_GONE_WAIT);
	expect(oldGone).toBe(true);

	// New codex should exist with updated suffix
	const newExists = await waitForFile(newCodexF3, CODEX_WAIT);
	expect(newExists).toBe(true);
}
