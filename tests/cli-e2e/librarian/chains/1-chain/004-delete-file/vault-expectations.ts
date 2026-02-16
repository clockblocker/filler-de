import { VAULT_EXPECTATIONS_003 } from "../../0-chain/003-create-and-rename-a-file/vault-expectations";

// After deleting Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md:
// - The file should no longer exist
// - The Fish codex (__-Fish-Pie-Recipe.md) should no longer reference Ingredients

const EXPECTED_CODEXES_AFTER_004 = VAULT_EXPECTATIONS_003.postHealing.codexes;

// Remove the deleted file from expected files
const EXPECTED_FILES_AFTER_004 = VAULT_EXPECTATIONS_003.postHealing.files.filter(
	(f) => f !== "Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
);

// Files that should no longer exist
const GONE_FILES_004 = ["Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md"];

// Content checks: verify remaining files are still in codex
const CONTENT_CHECKS_004: readonly [string, readonly string[]][] = [
	// Fish codex should still have Steps
	[
		"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		["Steps-Fish-Pie-Recipe"],
	],
];

// Negative content checks: verify deleted file is NOT in codex
const CONTENT_MUST_NOT_CONTAIN_004: readonly [string, readonly string[]][] = [
	// Fish codex should NOT reference Ingredients anymore
	[
		"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		["Ingredients-Fish-Pie-Recipe"],
	],
];

export const VAULT_EXPECTATIONS_004 = {
	initial: VAULT_EXPECTATIONS_003.postHealing,
	postHealing: {
		codexes: EXPECTED_CODEXES_AFTER_004,
		contentChecks: CONTENT_CHECKS_004,
		contentMustNotContain: CONTENT_MUST_NOT_CONTAIN_004,
		files: EXPECTED_FILES_AFTER_004,
		goneFiles: GONE_FILES_004,
	},
};
