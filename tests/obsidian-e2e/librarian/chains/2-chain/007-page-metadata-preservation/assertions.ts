/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import {
	CONTENT_CHECKS_007_AFTER_TOGGLE,
	CONTENT_CHECKS_007_INIT,
	CONTENT_MUST_NOT_CONTAIN_007_AFTER_TOGGLE,
	EXPECTED_CODEXES,
	PAGE_FILES,
	scenarioToContentChecks,
} from "./vault-expectations";

/**
 * Test: Codexes are created on init
 */
export async function testCodexesCreatedOnInit007(): Promise<void> {
	const t = createTestContext("testCodexesCreatedOnInit007");
	await t.expectFiles([...EXPECTED_CODEXES]);
}

/**
 * Test: Page files exist and have proper metadata after init.
 *
 * BUG 1 TEST: This catches the bug where page navigation indices
 * are not healed on init because metadata parsing fails silently.
 */
export async function testPageMetadataOnInit007(): Promise<void> {
	const t = createTestContext("testPageMetadataOnInit007");
	await t.gatherDebug("Library/Märchen/Aschenputtel");
	await t.expectPostHealing(
		{
			codexes: [],
			contentChecks: scenarioToContentChecks(CONTENT_CHECKS_007_INIT),
			files: [...PAGE_FILES],
		},
		{
			...HEALING_POLL_OPTIONS,
			logFolderOnFail: "Library/Märchen/Aschenputtel",
		},
	);
}

/**
 * Test: Page metadata is preserved after toggling status via codex checkbox.
 *
 * BUG 2 TEST: This catches the bug where clicking a codex checkbox
 * strips all metadata except status, losing prevPageIdx/nextPageIdx.
 */
export async function testPageMetadataPreservedAfterToggle007(): Promise<void> {
	const t = createTestContext("testPageMetadataPreservedAfterToggle007");
	await t.gatherDebug("Library/Märchen/Aschenputtel");
	await t.expectPostHealing(
		{
			codexes: [],
			contentChecks: scenarioToContentChecks(CONTENT_CHECKS_007_AFTER_TOGGLE),
			contentMustNotContain: scenarioToContentChecks(CONTENT_MUST_NOT_CONTAIN_007_AFTER_TOGGLE),
			files: [...PAGE_FILES],
		},
		{
			...HEALING_POLL_OPTIONS,
			logFolderOnFail: "Library/Märchen/Aschenputtel",
		},
	);
}

/**
 * Test: Page metadata is preserved after toggling status back to unchecked.
 */
export async function testPageMetadataPreservedAfterUntoggle007(): Promise<void> {
	const t = createTestContext("testPageMetadataPreservedAfterUntoggle007");
	await t.gatherDebug("Library/Märchen/Aschenputtel");

	// After untoggle, page 1 should be back to NotStarted but still have nav indices
	const contentChecks: [string, readonly string[]][] = [
		[
			"Library/Märchen/Aschenputtel/Aschenputtel_Page_001-Aschenputtel-Märchen.md",
			['"status":"NotStarted"', '"prevPageIdx":0', '"nextPageIdx":2', '"noteKind":"Page"'],
		],
	];

	await t.expectPostHealing(
		{
			codexes: [],
			contentChecks,
			files: [...PAGE_FILES],
		},
		{
			...HEALING_POLL_OPTIONS,
			logFolderOnFail: "Library/Märchen/Aschenputtel",
		},
	);
}
