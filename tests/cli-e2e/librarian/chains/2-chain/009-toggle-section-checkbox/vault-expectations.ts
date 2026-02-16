// Test: Toggle Berry section checkbox in Pie codex to Done (propagation)
// Berry codex has 3 checkboxable children: Ingredients, Steps, Renamed
// Checking Berry section → all Berry scrolls become Done
//
// Mutation: toggle "Berry" in Pie codex (wasChecked: false → mark Done)
// Expected: Berry codex shows [x] for all scrolls, Pie codex shows [x] Berry

const EXPECTED_CODEXES_009 = [
	"Library/Recipe/Pie/__-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
];

const EXPECTED_FILES_009 = [
	"Library/Recipe/Pie/Berry/Ingredients-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/Steps-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md",
];

const CONTENT_CHECKS_009: readonly [string, readonly string[]][] = [
	// Berry codex: all scroll lines should be checked
	[
		"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
		[
			"- [x] [[Ingredients-Berry-Pie-Recipe|Ingredients]]",
			"- [x] [[Steps-Berry-Pie-Recipe|Steps]]",
			"- [x] [[Renamed-Berry-Pie-Recipe|Renamed]]",
		],
	],
	// Pie codex: Berry section should be checked
	[
		"Library/Recipe/Pie/__-Pie-Recipe.md",
		["- [x] [[__-Berry-Pie-Recipe|Berry]]"],
	],
];

export const VAULT_EXPECTATIONS_009 = {
	postHealing: {
		codexes: EXPECTED_CODEXES_009,
		contentChecks: CONTENT_CHECKS_009,
		files: EXPECTED_FILES_009,
	},
};
