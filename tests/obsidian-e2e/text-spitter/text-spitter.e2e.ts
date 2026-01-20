/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { waitForIdle } from "../support/api/idle";
import {
	performMakeText,
	performSetup,
	testPostMakeText,
	testPostSetup,
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

	// Uncomment to keep Obsidian window open for manual inspection
	// after(async () => {
	// 	await new Promise(() => {});
	// });
});
