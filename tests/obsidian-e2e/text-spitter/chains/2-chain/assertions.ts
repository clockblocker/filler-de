/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../support/config";
import { EXPECTED_AFTER_MAKE_TEXT, EXPECTED_AFTER_SETUP } from "./vault-expectations";

/**
 * Verify state after setup (file moved to Library and healed).
 */
export async function testPostSetup(): Promise<void> {
	const t = createTestContext("testPostSetup");
	await t.expectPostHealing(EXPECTED_AFTER_SETUP, HEALING_POLL_OPTIONS);
}

/**
 * Verify state after "Make this a text" click.
 * This is the main assertion that checks:
 * - Section folder created
 * - Section codex created
 * - Pages created
 * - Original scroll deleted
 * - Parent codex updated (no dead link to scroll)
 */
export async function testPostMakeText(): Promise<void> {
	const t = createTestContext("testPostMakeText");
	await t.expectPostHealing(EXPECTED_AFTER_MAKE_TEXT, HEALING_POLL_OPTIONS);
}
