/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { waitForIdle } from "../support/api/idle";
import {
	testCodexesCreatedOnInit007,
	testPageMetadataOnInit007,
	testPageMetadataPreservedAfterToggle007,
	testPageMetadataPreservedAfterUntoggle007,
	performMutation007_togglePage1,
	performMutation007_untogglePage1,
} from "./chains/2-chain/007-page-metadata-preservation";

const VAULT_PATH = "tests/obsidian-e2e/vaults/page-metadata-test";

/**
 * Test suite for page metadata preservation bugs.
 *
 * Bug 1: Page navigation indices (prevPageIdx/nextPageIdx) not healed on init
 * Bug 2: Page metadata stripped when toggling status via codex checkbox
 */
describe("Page Metadata Preservation", () => {
	before(async () => {
		// Double reset ensures clean state
		await obsidianPage.resetVault(VAULT_PATH);
		await obsidianPage.resetVault(VAULT_PATH);
		await waitForIdle();
	});

	// === INIT TESTS ===

	it("007: creates all codex files on init", testCodexesCreatedOnInit007);

	it("007: page files have proper metadata after init (Bug 1 test)", testPageMetadataOnInit007);

	// === TOGGLE STATUS TESTS ===

	it("007: clicks Page_001 checkbox in Aschenputtel codex", async () => {
		await performMutation007_togglePage1();
		await waitForIdle();
	});

	it("007: page metadata preserved after status toggle (Bug 2 test)", testPageMetadataPreservedAfterToggle007);

	// === UNTOGGLE STATUS TESTS ===

	it("007: clicks Page_001 checkbox again (untoggle)", async () => {
		await performMutation007_untogglePage1();
		await waitForIdle();
	});

	it("007: page metadata preserved after untoggle", testPageMetadataPreservedAfterUntoggle007);

	// Uncomment to keep Obsidian open for debugging
	// after(async () => {
	// 	await new Promise(() => {});
	// });
});
