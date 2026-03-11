export const MOVED_SCROLL_INITIAL_PATH =
	"Library/Recipe/Pie/Berry/MoveByCli-Berry-Pie-Recipe.md";

export const MOVED_SCROLL_DESTINATION_FOLDER = "Library/Recipe/Pie/Fish";

export const MOVED_SCROLL_HEALED_PATH =
	"Library/Recipe/Pie/Fish/MoveByCli-Fish-Pie-Recipe.md";

const CONTENT_CHECKS_011: readonly [string, readonly string[]][] = [
	[
		"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		["MoveByCli-Fish-Pie-Recipe|MoveByCli"],
	],
];

const CONTENT_MUST_NOT_CONTAIN_011: readonly [string, readonly string[]][] = [
	[
		"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
		["MoveByCli"],
	],
];

export const VAULT_EXPECTATIONS_011 = {
	postHealing: {
		codexes: [
			"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
			"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		],
		contentChecks: CONTENT_CHECKS_011,
		contentMustNotContain: CONTENT_MUST_NOT_CONTAIN_011,
		files: [MOVED_SCROLL_HEALED_PATH],
		goneFiles: [MOVED_SCROLL_INITIAL_PATH],
	},
};
