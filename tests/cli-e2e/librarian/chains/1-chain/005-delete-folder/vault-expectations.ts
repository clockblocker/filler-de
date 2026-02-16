import { VAULT_EXPECTATIONS_004 } from "../004-delete-file/vault-expectations";

// After deleting Library/Recipe/Soup/Pho_Bo/ folder:
// - The entire folder and contents should no longer exist
// - The Soup codex (__-Soup-Recipe.md) should no longer reference Pho_Bo

// Remove Pho_Bo codex from expected codexes
const EXPECTED_CODEXES_AFTER_005 = VAULT_EXPECTATIONS_004.postHealing.codexes.filter(
	(c) => !c.includes("Pho_Bo"),
);

// Remove all Pho_Bo files from expected files
const EXPECTED_FILES_AFTER_005 = VAULT_EXPECTATIONS_004.postHealing.files.filter(
	(f) => !f.includes("Pho_Bo"),
);

// Files/folders that should no longer exist
const GONE_FILES_005 = [
	"Library/Recipe/Soup/Pho_Bo/__-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Ingredients-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Steps-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Result_picture-Pho_Bo-Soup-Recipe.jpg",
];

// Content checks: verify Ramen is still in Soup codex
const CONTENT_CHECKS_005: readonly [string, readonly string[]][] = [
	// Soup codex should still have Ramen
	[
		"Library/Recipe/Soup/__-Soup-Recipe.md",
		["[[__-Ramen-Soup-Recipe|Ramen]]"],
	],
];

// Negative content checks: verify deleted folder is NOT in parent codex
const CONTENT_MUST_NOT_CONTAIN_005: readonly [string, readonly string[]][] = [
	// Soup codex should NOT reference Pho_Bo anymore
	[
		"Library/Recipe/Soup/__-Soup-Recipe.md",
		["Pho_Bo"],
	],
];

export const VAULT_EXPECTATIONS_005 = {
	initial: VAULT_EXPECTATIONS_004.postHealing,
	postHealing: {
		codexes: EXPECTED_CODEXES_AFTER_005,
		contentChecks: CONTENT_CHECKS_005,
		contentMustNotContain: CONTENT_MUST_NOT_CONTAIN_005,
		files: EXPECTED_FILES_AFTER_005,
		goneFiles: GONE_FILES_005,
	},
};
