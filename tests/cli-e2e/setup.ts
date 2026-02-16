import { createFile, createFiles, deleteAllUnder, reloadPlugin, waitForIdle } from "./utils";

/**
 * Fixture data: the initial vault structure matching librarian-chain-0.
 * These files are created via CLI before tests run.
 */
const FIXTURE_FILES: readonly { path: string; content: string }[] = [
	{ content: "# Ingredients", path: "Library/Recipe/Pie/Ingredients.md" },
	{ content: "# Steps", path: "Library/Recipe/Pie/Steps.md" },
	{ content: "", path: "Library/Recipe/Pie/Result_picture.jpg" },
	{ content: "# Ingredients", path: "Library/Recipe/Soup/Pho_Bo/Ingredients.md" },
	{ content: "# Steps", path: "Library/Recipe/Soup/Pho_Bo/Steps.md" },
	{ content: "", path: "Library/Recipe/Soup/Pho_Bo/Result_picture.jpg" },
	{ content: "", path: "Outside/Avatar-S1-E1.md" },
];

/**
 * Set up the test vault: clean Library/ and Outside/, recreate fixtures,
 * reload the plugin, and wait for healing to complete.
 */
export async function setupTestVault(): Promise<void> {
	// Clean up any leftover state
	await deleteAllUnder("Library");
	await deleteAllUnder("Outside");

	// Create fixture files
	await createFiles(FIXTURE_FILES);

	// Reload plugin so it discovers the new vault state
	await reloadPlugin();

	// Wait for initial healing to complete
	await waitForIdle();
}
