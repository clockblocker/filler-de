/**
 * Vault expectations for page metadata preservation tests.
 *
 * Tests Bug 1: Page metadata (prevPageIdx/nextPageIdx) should be healed on init
 * Tests Bug 2: Page metadata should not be stripped when toggling status via codex checkbox
 */

// Files in the test vault
export const PAGE_FILES = [
	"Library/Märchen/Aschenputtel/Aschenputtel_Page_000-Aschenputtel-Märchen.md",
	"Library/Märchen/Aschenputtel/Aschenputtel_Page_001-Aschenputtel-Märchen.md",
	"Library/Märchen/Aschenputtel/Aschenputtel_Page_002-Aschenputtel-Märchen.md",
] as const;

// Codexes that should be created
export const EXPECTED_CODEXES = [
	"Library/__-Library.md",
	"Library/Märchen/__-Märchen.md",
	"Library/Märchen/Aschenputtel/__-Aschenputtel-Märchen.md",
] as const;

// Content checks for page metadata on init
// Page 0 should have nextPageIdx:1, no prevPageIdx
// Page 1 should have prevPageIdx:0, nextPageIdx:2
// Page 2 should have prevPageIdx:1, no nextPageIdx
export const CONTENT_CHECKS_007_INIT = {
	page0HasNextIdx: [
		"Library/Märchen/Aschenputtel/Aschenputtel_Page_000-Aschenputtel-Märchen.md",
		['"nextPageIdx":1', '"noteKind":"Page"'],
	] as const,
	page1HasBothIdx: [
		"Library/Märchen/Aschenputtel/Aschenputtel_Page_001-Aschenputtel-Märchen.md",
		['"prevPageIdx":0', '"nextPageIdx":2', '"noteKind":"Page"'],
	] as const,
	page2HasPrevIdx: [
		"Library/Märchen/Aschenputtel/Aschenputtel_Page_002-Aschenputtel-Märchen.md",
		['"prevPageIdx":1', '"noteKind":"Page"'],
	] as const,
};

// Content checks AFTER clicking checkbox on page 1 (should toggle status but preserve nav indices)
export const CONTENT_CHECKS_007_AFTER_TOGGLE = {
	// Codex should show checked checkbox
	codexShowsPage1Checked: [
		"Library/Märchen/Aschenputtel/__-Aschenputtel-Märchen.md",
		["- [x]"],
	] as const,
	// Page 1 should now have status:Done AND still have prevPageIdx/nextPageIdx
	page1HasStatusDoneAndNavIdx: [
		"Library/Märchen/Aschenputtel/Aschenputtel_Page_001-Aschenputtel-Märchen.md",
		['"status":"Done"', '"prevPageIdx":0', '"nextPageIdx":2', '"noteKind":"Page"'],
	] as const,
};

// Content that must NOT be present after toggle (negative checks)
export const CONTENT_MUST_NOT_CONTAIN_007_AFTER_TOGGLE = {
	// Page 1 should NOT have status NotStarted after toggle
	page1NoNotStarted: [
		"Library/Märchen/Aschenputtel/Aschenputtel_Page_001-Aschenputtel-Märchen.md",
		['"status":"NotStarted"'],
	] as const,
};

// Helper to convert scenario content checks to PostHealingExpectations format
export function scenarioToContentChecks(
	scenario: Record<string, readonly [string, readonly string[]]>,
): [string, readonly string[]][] {
	return Object.values(scenario)
		.filter(([_, lines]) => lines.length > 0)
		.map(([path, lines]) => [path, lines]);
}
