/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { waitForIdle } from "../support/api/idle";
import {
	performMakeText,
	performMakeTextExtraE2,
	performSetup,
	performSetupExtraE2,
	testNavigationButtons,
	testPostMakeText,
	testPostMakeTextExtraE2,
	testPostSetup,
	testPostSetupExtraE2,
} from "./chains/2-chain";

const VAULT_PATH = "tests/obsidian-e2e/vaults/text-spitter";

/**
 * Text Spitter E2E Test Suite
 *
 * Tests the "Make this a text" flow:
 * 1. Create scroll file and move to Library
 * 2. Open file and click "Make this a text" button
 * 3. Verify:
 *    - Section folder created
 *    - Section codex created
 *    - Pages created from scroll split
 *    - Original scroll deleted
 *    - Parent codex updated (links to section, not dead scroll link)
 */
describe("Text Spitter - Bookkeeper/Librarian Integration", () => {
	before(async () => {
		// Double reset ensures clean state: 1st loads plugin, 2nd gives clean files
		await obsidianPage.resetVault(VAULT_PATH);
		await obsidianPage.resetVault(VAULT_PATH);
		await waitForIdle();
	});

	// Setup: Create file and move to Library
	it("creates scroll file and moves to Library", async () => {
		await performSetup();
	});

	// Verify setup healing
	it("verifies scroll healed to Library/Märchen/", async () => {
		await testPostSetup();
	});

	// Click "Make this a text" button
	it("clicks Make this a text button", async () => {
		await performMakeText();
	});

	// Verify post-healing state
	it("verifies section codex and pages created correctly", async () => {
		await testPostMakeText();
	});

	// Test navigation buttons on Page file
	it("tests navigation button diagnostics", async () => {
		await testNavigationButtons();
	});

	// --- EXTRA_E2: Dialogue content with headings ---

	// Setup EXTRA_E2: Create file and move to Library
	it("creates EXTRA_E2 dialogue scroll and moves to Library", async () => {
		await performSetupExtraE2();
	});

	// Verify EXTRA_E2 setup healing
	it("verifies EXTRA_E2 scroll healed to Library/Dialog/", async () => {
		await testPostSetupExtraE2();
	});

	// Click "Make this a text" button for EXTRA_E2
	it("clicks Make this a text button for EXTRA_E2", async () => {
		await performMakeTextExtraE2();
	});

	// Verify EXTRA_E2 post-healing state (headings preserved as metadata)
	it("verifies EXTRA_E2 section codex and pages created with headings preserved", async () => {
		await testPostMakeTextExtraE2();
	});

	// Uncomment to keep Obsidian window open for manual inspection
	// after(async () => {
	// 	await new Promise(() => {});
	// });
});
