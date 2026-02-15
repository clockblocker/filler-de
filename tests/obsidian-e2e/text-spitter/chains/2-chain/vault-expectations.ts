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
	files: [
		// Pages created from scroll split
		`Library/Märchen/Aschenputtel/Aschenputtel_Page_000${D}Aschenputtel${D}Märchen.md`,
	],
	goneFiles: [
		// Original scroll should be deleted after split
		`Library/Märchen/Aschenputtel${D}Märchen.md`,
	],
};

/**
 * Expected state after EXTRA_E2 setup (file created and moved to Library).
 * Librarian heals:
 * - ExtraE2-Dialog.md → Library/Dialog/ExtraE2-Dialog.md
 */
export const EXPECTED_AFTER_SETUP_EXTRA_E2 = {
	codexes: [
		`Library/__${D}Library.md`,
		`Library/Märchen/__${D}Märchen.md`,
		// NOTE: Aschenputtel codex NOT expected - MakeText test is skipped
		`Library/Dialog/__${D}Dialog.md`,
	],
	files: [
		// Scroll file still exists (MakeText skipped, so not converted to section)
		`Library/Märchen/Aschenputtel${D}Märchen.md`,
		// Scroll file after healing
		`Library/Dialog/ExtraE2${D}Dialog.md`,
	],
};

/**
 * Expected state after EXTRA_E2 "Make this a text" button click.
 * Tests that dialogue content with headings is properly split.
 */
export const EXPECTED_AFTER_MAKE_TEXT_EXTRA_E2 = {
	codexes: [
		`Library/__${D}Library.md`,
		`Library/Märchen/__${D}Märchen.md`,
		`Library/Märchen/Aschenputtel/__${D}Aschenputtel${D}Märchen.md`,
		`Library/Dialog/__${D}Dialog.md`,
		// NEW: Section codex for ExtraE2 folder
		`Library/Dialog/ExtraE2/__${D}ExtraE2${D}Dialog.md`,
	],
	contentChecks: [
		// Parent codex should contain link to section (not scroll)
		[`Library/Dialog/__${D}Dialog.md`, ["ExtraE2"]],
		// CRITICAL: Page content should have headings on their own lines, not merged with content
		// This verifies the heading preservation fix is working
		[
			`Library/Dialog/ExtraE2/ExtraE2_Page_000${D}ExtraE2${D}Dialog.md`,
			[
				"###### **ANNA:**\n", // Heading followed by newline (not merged with content)
			],
		],
	] as [string, string[]][],
	contentMustNotContain: [
		// Parent codex should NOT have old scroll link format
		[`Library/Dialog/__${D}Dialog.md`, [`[[ExtraE2${D}Dialog|`]],
		// CRITICAL: Page should NOT have headings merged with content
		// If this appears, the heading fix is broken
		[
			`Library/Dialog/ExtraE2/ExtraE2_Page_000${D}ExtraE2${D}Dialog.md`,
			[
				"###### **ANNA:**Groß", // Bad: heading merged with content
			],
		],
	] as [string, string[]][],
	files: [
		// Pages created from scroll split - should have multiple pages
		`Library/Dialog/ExtraE2/ExtraE2_Page_000${D}ExtraE2${D}Dialog.md`,
	],
	goneFiles: [
		// Original scroll should be deleted after split
		`Library/Dialog/ExtraE2${D}Dialog.md`,
	],
};
