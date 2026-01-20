/**
 * Vault expectations for text-spitter E2E test.
 * Tests the "Make this a text" flow: scroll → section with pages.
 */

// Suffix delimiter (matches default settings: "-")
const D = "-";

/**
 * Expected state after setup (file created and moved to Library).
 * Librarian heals:
 * - Aschenputtel-Märchen.md → Library/Märchen/Aschenputtel-Märchen.md
 */
export const EXPECTED_AFTER_SETUP = {
	codexes: [
		`Library/__${D}Library.md`,
		`Library/Märchen/__${D}Märchen.md`,
	],
	files: [
		// Scroll file after healing
		`Library/Märchen/Aschenputtel${D}Märchen.md`,
	],
};

/**
 * Expected state after "Make this a text" button click.
 * Bookkeeper splits scroll into pages, Librarian creates section codex.
 */
export const EXPECTED_AFTER_MAKE_TEXT = {
	codexes: [
		`Library/__${D}Library.md`,
		`Library/Märchen/__${D}Märchen.md`,
		// NEW: Section codex for Aschenputtel folder
		`Library/Märchen/Aschenputtel/__${D}Aschenputtel${D}Märchen.md`,
	],
	files: [
		// Pages created from scroll split
		`Library/Märchen/Aschenputtel/Aschenputtel_Page_000${D}Aschenputtel${D}Märchen.md`,
	],
	goneFiles: [
		// Original scroll should be deleted after split
		`Library/Märchen/Aschenputtel${D}Märchen.md`,
	],
	contentChecks: [
		// Parent codex should contain link to section (not scroll)
		// The section node name is "Aschenputtel"
		[`Library/Märchen/__${D}Märchen.md`, ["Aschenputtel"]],
	] as [string, string[]][],
	contentMustNotContain: [
		// Parent codex should NOT have old scroll link format (without __ prefix)
		// Dead link format: [[Aschenputtel-Märchen|Aschenputtel]] (direct link to scroll)
		// Section link format: [[__-Aschenputtel-Märchen|Aschenputtel]] (link to codex)
		// Use prefix to distinguish: scroll links start with [[Aschenputtel-, codex links start with [[__-
		[`Library/Märchen/__${D}Märchen.md`, [`[[Aschenputtel${D}Märchen|`]],
	] as [string, string[]][],
};
