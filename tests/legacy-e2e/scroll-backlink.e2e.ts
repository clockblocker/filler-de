/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { INIT_HEALING_WAIT_MS } from "../obsidian-e2e/helpers/polling";
import {
	testScrollBacklinkAddedOnCreation,
	testScrollBacklinkPointsToImmediateParent,
	testScrollBacklinkPreservesContentOnMove,
} from "../obsidian-e2e/librarian/healing-legacy/scroll-backlink.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/scroll-backlink";

describe("Scroll Backlink Healing", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS));
	});

	it("adds backlink on scroll creation", testScrollBacklinkAddedOnCreation);
	it("backlink points to immediate parent", testScrollBacklinkPointsToImmediateParent);
	it("preserves user content when scroll is moved", testScrollBacklinkPreservesContentOnMove);
});
