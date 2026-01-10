import { EXPECTED_CODEXES_AFTER_000, EXPECTED_FILES_AFTER_000 } from "../000-init/vault-expectations";

const FILES_AND_CODEXES_ON_STARTUP = [
    ...EXPECTED_CODEXES_AFTER_000,
    ...EXPECTED_FILES_AFTER_000,
];

const EXPECTED_CODEXES_POST_MUTATION = [
    ...EXPECTED_CODEXES_AFTER_000,
];

const EXPECTED_FILES_POST_MUTATION = [
    ...EXPECTED_FILES_AFTER_000,
    // New Berry_Pie folder (without proper codex/suffixes yet)
    "Library/Recipe/Berry_Pie/Ingredients.md",
    "Library/Recipe/Berry_Pie/Steps.md",
    "Library/Recipe/Berry_Pie/Result_picture.jpg",
    // New Avatar files
    "Library/Avatar-S1-E2.md",
    "Library/Avatar-S2-E1.md",
    // Root level files (should be moved/healed)
    "Library/Ingredients.md",
    "Library/Steps.md",
    "Library/Result_picture.jpg",
];

const EXPECTED_CODEXES_AFTER_001 = [
    ...EXPECTED_CODEXES_AFTER_000,
    "Library/Recipe/Berry_Pie/__-Berry_Pie-Recipe.md",
    "Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md",
];

const EXPECTED_FILES_AFTER_001 = [
    // Original files
    ...EXPECTED_FILES_AFTER_000,
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
    "Library/Avatar-S1-E1.md",
    "Library/Avatar-S1-E2.md",
    "Library/Avatar-S2-E1.md",
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
    postMutation: {
        codexes: EXPECTED_CODEXES_POST_MUTATION,
        files: EXPECTED_FILES_POST_MUTATION,
    },
}


