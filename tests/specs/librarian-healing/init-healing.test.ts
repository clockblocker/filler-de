/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { VaultActionManagerTestingApi } from "../dispatcher/utils";

/**
 * Test Mode 2 (Init) healing: suffix-only renames.
 * Path is king - files stay in place, suffixes get fixed.
 */
export const testInitHealing = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		// Create files with WRONG suffixes (mismatch with path)
		const testFiles = [
			// File at Library/A/B/ but has suffix -X-Y (wrong)
			{
				expectedBasename: "Note1-B-A.md",
				path: "Library/A/B/Note1-X-Y.md",
			},
			// File at Library/A/ but has suffix -Z (wrong)
			{
				expectedBasename: "Note2-A.md",
				path: "Library/A/Note2-Z.md",
			},
			// File at Library root with extra suffix (should have none)
			{
				expectedBasename: "Note3.md",
				path: "Library/Note3-Extra.md",
			},
			// File with correct suffix (should not be renamed)
			{
				expectedBasename: "Correct-A.md",
				path: "Library/A/Correct-A.md",
			},
		];

		// Create the test files
		for (const { path } of testFiles) {
			const sp = splitPath(path);
			await manager.dispatch([
				{
					payload: { content: "", splitPath: sp },
					type: "UpsertMdFile",
				},
			]);
		}

		// Small delay for filesystem
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Get Librarian class and create instance
		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		if (!plugin?.getLibrarianClass) {
			throw new Error("getLibrarianClass not available");
		}

		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		// Run init healing
		const healResult = await librarian.init();

		// Check results
		const healedCount = healResult.renameActions.length;

		// Verify files were renamed correctly
		const verifications = await Promise.all(
			testFiles.map(async ({ path, expectedBasename }) => {
				const pathParts = path.split("/");
				const folder = pathParts.slice(0, -1).join("/");
				const expectedPath = folder
					? `${folder}/${expectedBasename}`
					: expectedBasename;

				const sp = splitPath(expectedPath);
				const exists = await manager.exists(sp);
				return { exists, expectedPath, originalPath: path };
			}),
		);

		return {
			healedCount,
			success: true,
			verifications,
		};
	});

	expect(result.success).toBe(true);

	// Note: The main plugin's handleCreate listener auto-heals files on creation
	// So by the time librarian.init() runs, most files are already healed
	// The important thing is that all files end up at correct paths
	
	// All files should exist at their expected paths after healing
	for (const v of result.verifications) {
		expect(v.exists).toBe(true);
	}
};

/**
 * Test that init healing preserves files already correctly named.
 */
export const testInitHealingNoOpForCorrectFiles = async () => {
	const result = await browser.executeObsidian(async ({ app }: any) => {
		const vaultApi = app?.plugins?.plugins?.["cbcr-text-eater-de"]
			?.getVaultActionManagerTestingApi?.() as
			| VaultActionManagerTestingApi
			| undefined;
		if (!vaultApi) throw new Error("vault testing api unavailable");

		const { manager, splitPath } = vaultApi;
		if (!manager) throw new Error("manager is undefined");

		// Create files with CORRECT suffixes
		const testFiles = [
			"Library/A/Note1-A.md",
			"Library/A/B/Note2-B-A.md",
			"Library/RootNote.md",
		];

		for (const path of testFiles) {
			const sp = splitPath(path);
			await manager.dispatch([
				{
					payload: { content: "", splitPath: sp },
					type: "UpsertMdFile",
				},
			]);
		}

		await new Promise((resolve) => setTimeout(resolve, 100));

		const plugin = app?.plugins?.plugins?.["cbcr-text-eater-de"];
		const LibrarianClass = plugin.getLibrarianClass();
		const librarian = new LibrarianClass(manager as any, "Library", "-");

		const healResult = await librarian.init();

		return {
			healedCount: healResult.renameActions.length,
			success: true,
		};
	});

	expect(result.success).toBe(true);
	// No files should need healing
	expect(result.healedCount).toBe(0);
};
