import { EXPECTED_CODEXES_AFTER_000, EXPECTED_FILES_AFTER_000 } from "../000-init/vault-expectations";

const NEW_CODEXES_AFTER_001 = [
   "Library/Recipe/Berry_Pie/__-Berry_Pie-Recipe.md",
   "Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
]

const NEW_FILES_AFTER_001 = [
    // Berry_Pie with proper suffixes
    "Library/Recipe/Berry_Pie/__-Berry_Pie-Recipe.md",
    "Library/Recipe/Berry_Pie/Ingredients-Berry_Pie-Recipe.md",
    "Library/Recipe/Berry_Pie/Steps-Berry_Pie-Recipe.md",
    "Library/Recipe/Berry_Pie/Result_picture-Berry_Pie-Recipe.jpg",
    // Ramen folder
    "Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
    "Library/Recipe/Soup/Ramen/Ingredients-Ramen-Soup-Recipe.md",
    "Library/Recipe/Soup/Ramen/Steps-Ramen-Soup-Recipe.md",
    "Library/Recipe/Soup/Ramen/Result_picture-Ramen-Soup-Recipe.jpg",
    // Avatar files
    "Outside/Avatar-S1-E1.md",
    "Outside/Avatar-S1-E2.md",
    "Outside/Avatar-S2-E1.md",
]

const EXPECTED_CODEXES_AFTER_001 = [
    ...EXPECTED_CODEXES_AFTER_000,
    ...NEW_CODEXES_AFTER_001
];

const EXPECTED_FILES_AFTER_001 = [
    // Original files
    ...EXPECTED_FILES_AFTER_000,
    ...NEW_FILES_AFTER_001
];

export const VAULT_EXPECTATIONS_001 = {
    initial: {
        codexes: EXPECTED_CODEXES_AFTER_000,
        files: EXPECTED_FILES_AFTER_000,
    },
    postHealing: {
        codexes: EXPECTED_CODEXES_AFTER_001,
        files: EXPECTED_FILES_AFTER_001,
    },
}


