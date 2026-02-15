export const EXPECTED_CODEXES_AFTER_000 = [
	"Library/__-Library.md",
	"Library/Recipe/__-Recipe.md",
	"Library/Recipe/Pie/__-Pie-Recipe.md",
	"Library/Recipe/Soup/__-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/__-Pho_Bo-Soup-Recipe.md",
];

export const EXPECTED_FILES_AFTER_000 = [
	// Pie
	"Library/Recipe/Pie/Ingredients-Pie-Recipe.md",
	"Library/Recipe/Pie/Steps-Pie-Recipe.md",
	"Library/Recipe/Pie/Result_picture-Pie-Recipe.jpg",
	
	// Pho Bo
	"Library/Recipe/Soup/Pho_Bo/Ingredients-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Steps-Pho_Bo-Soup-Recipe.md",
	"Library/Recipe/Soup/Pho_Bo/Result_picture-Pho_Bo-Soup-Recipe.jpg",
	
	// Outside Library files - should NOT have suffixes
	"Outside/Avatar-S1-E1.md",
];

const FILES_ON_STARTUP = [
    "Library/Recipe/Pie/Ingredients.md",
    "Library/Recipe/Pie/Steps.md",
    "Library/Recipe/Pie/Result_picture.jpg",
    "Library/Recipe/Soup/Pho_Bo/Ingredients.md",
    "Library/Recipe/Soup/Pho_Bo/Steps.md",
    "Library/Recipe/Soup/Pho_Bo/Result_picture.jpg",
    "Outside/Avatar-S1-E1.md",
];


export const VAULT_EXPECTATIONS_000 = {
    initial: {
        codexes: [],
        files: FILES_ON_STARTUP,
    },
    postHealing: {
        codexes: EXPECTED_CODEXES_AFTER_000,
        files: EXPECTED_FILES_AFTER_000,
    },
}


