import { VAULT_EXPECTATIONS_002 } from "../002-rename-files/vault-expectations";

// After creating and renaming a file:
// 1. Create MyNote.md in Library/Recipe/Pie/Berry/
// 2. Healing renames to MyNote-Berry-Pie-Recipe.md, codexes updated
// 3. User renames to Renamed-Berry-Pie-Recipe.md
// 4. Bug: codexes still point to MyNote instead of Renamed

const EXPECTED_CODEXES_AFTER_003 = VAULT_EXPECTATIONS_002.postHealing.codexes;

const EXPECTED_FILES_AFTER_003 = [
    ...VAULT_EXPECTATIONS_002.postHealing.files,
    // The renamed file should exist
    "Library/Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md",
];

// Content checks: verify parent codex has updated child name after rename
// Bug reproduction: codex still shows MyNote instead of Renamed
// NOTE: Discovered that new files with suffix aren't added to codex at all!
const CONTENT_CHECKS_003: readonly [string, readonly string[]][] = [
    // Berry codex should have Renamed as child (NOT MyNote)
    // First check if the file is in codex at all (either MyNote or Renamed)
    [
        "Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
        ["Renamed-Berry-Pie-Recipe"],  // Just check the link target exists
    ],
];

export const VAULT_EXPECTATIONS_003 = {
    initial: VAULT_EXPECTATIONS_002.postHealing,
    postHealing: {
        codexes: EXPECTED_CODEXES_AFTER_003,
        contentChecks: CONTENT_CHECKS_003,
        files: EXPECTED_FILES_AFTER_003,
    },
};
