import { VAULT_EXPECTATIONS_005 } from "../005-delete-folder/vault-expectations";

// Bug reproduction: Multiple back-to-back renames of coreName
// 1. Create Library/Recipe/Soup/Ramen/Untitled-Ramen-Soup-Recipe.md
// 2. Rename to Draft-Ramen-Soup-Recipe.md
// 3. Rename to Review-Ramen-Soup-Recipe.md
// 4. Rename to Final-Ramen-Soup-Recipe.md
// Bug: Codex may show old name (Untitled/Draft/Review) instead of Final

const EXPECTED_CODEXES_AFTER_006 = VAULT_EXPECTATIONS_005.postHealing.codexes;

const EXPECTED_FILES_AFTER_006 = [
	...VAULT_EXPECTATIONS_005.postHealing.files,
	// The final renamed file should exist
	"Library/Recipe/Soup/Ramen/Final-Ramen-Soup-Recipe.md",
];

// Content checks: verify codex has correct display name after all renames
const CONTENT_CHECKS_006: readonly [string, readonly string[]][] = [
	// Ramen codex should show "Final" as display name
	[
		"Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
		["[[Final-Ramen-Soup-Recipe|Final]]"],
	],
];

// Negative content checks: old names should NOT appear
const CONTENT_MUST_NOT_CONTAIN_006: readonly [string, readonly string[]][] = [
	// Ramen codex should NOT show any of the old names
	[
		"Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
		["Untitled", "Draft", "Review"],
	],
];

export const VAULT_EXPECTATIONS_006 = {
	initial: VAULT_EXPECTATIONS_005.postHealing,
	postHealing: {
		codexes: EXPECTED_CODEXES_AFTER_006,
		contentChecks: CONTENT_CHECKS_006,
		contentMustNotContain: CONTENT_MUST_NOT_CONTAIN_006,
		files: EXPECTED_FILES_AFTER_006,
	},
};
