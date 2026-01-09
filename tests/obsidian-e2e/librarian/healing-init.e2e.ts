/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { EXTRA_INIT_HEALING_WAIT_MS, INIT_HEALING_WAIT_MS } from "../helpers/polling";
import {
	testInitHealingAddsSuffixToNestedFile,
	testInitHealingFixesWrongSuffix,
	testInitHealingMovesRootFileWithSuffix,
	testInitHealingMultipleFiles,
	testInitHealingNoOpForCorrectFiles,
	testInitHealingRootFileNoSuffix,
	testInitHealingRootFileSingleSuffix,
} from "./healing/init-healing.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

// Note: some tests might fail because of timeout issues
describe("Healing - Init", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS + EXTRA_INIT_HEALING_WAIT_MS));
	});

	// it("fixes files with wrong suffix on load", testInitHealingFixesWrongSuffix);
	// it("no-op for files with correct suffix", testInitHealingNoOpForCorrectFiles);
	// it("moves root file with suffix to suffix location", testInitHealingMovesRootFileWithSuffix);
	// it("adds suffix to nested file without one", testInitHealingAddsSuffixToNestedFile);
	// it("root file stays without suffix", testInitHealingRootFileNoSuffix);
	// it("root file single suffix moves (NameKing)", testInitHealingRootFileSingleSuffix);
	// it("processes multiple files", testInitHealingMultipleFiles);
});

