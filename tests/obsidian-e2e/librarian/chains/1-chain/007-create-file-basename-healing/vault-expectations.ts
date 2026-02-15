// Test: Create a new file without suffix and verify:
// 1. Healing adds the correct suffix to basename
// 2. Go-back link is added (exactly ONE, not duplicated)
//
// Create: Library/Recipe/Soup/Ramen/NewScroll.md
// Expected after healing: Library/Recipe/Soup/Ramen/NewScroll-Ramen-Soup-Recipe.md

// Only check the files specific to this test - don't inherit all previous expectations
// This prevents cascade failures from earlier tests
const EXPECTED_CODEXES_007 = [
	// Only the Ramen codex matters for this test
	"Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
];

const EXPECTED_FILES_007 = [
	// The new file should be renamed to include the suffix
	"Library/Recipe/Soup/Ramen/NewScroll-Ramen-Soup-Recipe.md",
];

// Content checks: verify codex has the new file with correct display name
// AND verify scroll has exactly ONE go-back link
const CONTENT_CHECKS_007: readonly [string, readonly string[]][] = [
	// Ramen codex should show "NewScroll" as display name
	[
		"Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
		["[[NewScroll-Ramen-Soup-Recipe|NewScroll]]"],
	],
	// NewScroll should have go-back link to Ramen codex
	[
		"Library/Recipe/Soup/Ramen/NewScroll-Ramen-Soup-Recipe.md",
		["[[__-Ramen-Soup-Recipe|← Ramen]]"],
	],
];

// Negative content checks: verify NO duplicate go-back links
// Real duplicate pattern from user's vault:
// [[__;;Das Sagt Mann So;;Text|← Das Sagt Mann So]]
// [[__;;Das Sagt Mann So;;Text|← Das Sagt Mann So]]
// Pattern: "]] \n[[__" (end of link, space, newline, start of next codex link)
const CONTENT_MUST_NOT_CONTAIN_007: readonly [string, readonly string[]][] = [
	// NewScroll should NOT have duplicate go-back links
	[
		"Library/Recipe/Soup/Ramen/NewScroll-Ramen-Soup-Recipe.md",
		["]] \n[[__-Ramen-Soup-Recipe"],
	],
];

// The file WITHOUT suffix should NOT exist after healing
const GONE_FILES_007 = ["Library/Recipe/Soup/Ramen/NewScroll.md"];

export const VAULT_EXPECTATIONS_007 = {
	postHealing: {
		codexes: EXPECTED_CODEXES_007,
		contentChecks: CONTENT_CHECKS_007,
		contentMustNotContain: CONTENT_MUST_NOT_CONTAIN_007,
		files: EXPECTED_FILES_007,
		goneFiles: GONE_FILES_007,
	},
};
