import { VAULT_EXPECTATIONS_001 } from "../001-create-more-files/vault-expectations";

// After renaming:
// - Berry_Pie -> Berry-Pie means: move Berry_Pie under Pie/Berry (hyphen = parent-child)
// - Pie -> Fish-Pie means: move Pie under Pie/Fish (hyphen = parent-child)
// Suffixes update to reflect new tree position

const EXPECTED_CODEXES_AFTER_002 = [
	"Library/__-Library.md",
	"Library/Recipe/__-Recipe.md",
	"Library/Recipe/Pie/__-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
	"Library/Recipe/Soup/__-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/__-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
];

const EXPECTED_FILES_AFTER_002 = [
	// Berry (moved from Berry_Pie to Pie/Berry, suffix updated)
	"Library/Recipe/Pie/Berry/Ingredients-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/Steps-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/Result_picture-Berry-Pie-Recipe.jpg",

	// Fish (moved from Pie to Pie/Fish, suffix updated)
	"Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
	"Library/Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
	"Library/Recipe/Pie/Fish/Result_picture-Fish-Pie-Recipe.jpg",

	// Pho_Bo (unchanged)
	"Library/Recipe/Soup/Pho_Bo/Ingredients-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Steps-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Result_picture-Pho_Bo-Soup-Recipe.jpg",

	// Ramen (unchanged)
	"Library/Recipe/Soup/Ramen/Ingredients-Ramen-Soup-Recipe.md",
	"Library/Recipe/Soup/Ramen/Steps-Ramen-Soup-Recipe.md",
	"Library/Recipe/Soup/Ramen/Result_picture-Ramen-Soup-Recipe.jpg",

	// Outside files (unchanged)
	"Outside/Avatar-S1-E1.md",
	"Outside/Avatar-S1-E2.md",
	"Outside/Avatar-S2-E1.md",
];

// Content checks: verify parent codexes have new child names after rename healing
const CONTENT_CHECKS_002: readonly [string, readonly string[]][] = [
	// Recipe codex should have Pie as child section
	[
		"Library/Recipe/__-Recipe.md",
		["[[__-Pie-Recipe|Pie]]"],
	],
	// Pie codex should have Berry and Fish as children
	[
		"Library/Recipe/Pie/__-Pie-Recipe.md",
		["[[__-Berry-Pie-Recipe|Berry]]", "[[__-Fish-Pie-Recipe|Fish]]"],
	],
];

export const VAULT_EXPECTATIONS_002 = {
	initial: VAULT_EXPECTATIONS_001.postHealing,
	postHealing: {
		codexes: EXPECTED_CODEXES_AFTER_002,
		contentChecks: CONTENT_CHECKS_002,
		files: EXPECTED_FILES_AFTER_002,
	},
};
