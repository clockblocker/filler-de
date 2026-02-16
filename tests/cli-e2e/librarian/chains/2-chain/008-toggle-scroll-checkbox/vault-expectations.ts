// Test: Toggle the sole scroll checkbox in Fish codex to Done
// Fish codex has only 1 checkboxable child: Steps (Result_picture is jpg → no checkbox)
// Checking Steps → Fish section becomes Done in Pie codex
//
// Mutation: toggle "Steps" in Fish codex (wasChecked: false → mark Done)
// Expected: Fish codex shows [x] Steps, Pie codex shows [x] Fish

const EXPECTED_CODEXES_008 = [
	"Library/Recipe/Pie/__-Pie-Recipe.md",
	"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
];

const EXPECTED_FILES_008 = [
	"Library/Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
];

const CONTENT_CHECKS_008: readonly [string, readonly string[]][] = [
	// Fish codex: Steps should be checked
	[
		"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		["- [x] [[Steps-Fish-Pie-Recipe|Steps]]"],
	],
	// Pie codex: Fish section should be checked (sole scroll Done → section Done)
	[
		"Library/Recipe/Pie/__-Pie-Recipe.md",
		["- [x] [[__-Fish-Pie-Recipe|Fish]]"],
	],
];

export const VAULT_EXPECTATIONS_008 = {
	postHealing: {
		codexes: EXPECTED_CODEXES_008,
		contentChecks: CONTENT_CHECKS_008,
		files: EXPECTED_FILES_008,
	},
};
