/// <reference types="@wdio/globals/types" />
import { obsidianPage } from "wdio-obsidian-service";
import { INIT_HEALING_WAIT_MS } from "../obsidian-e2e/helpers/polling";
import {
	testFileWithCorrectSuffixNoOp,
	testFileWithWrongSuffixHealed,
	testNestedFileGetsSuffix,
	testRootFileNoSuffix,
} from "../obsidian-e2e/librarian/healing/file-create.test";

const VAULT_PATH = "tests/obsidian-e2e/vaults/healing";

describe("Healing - File Create", () => {
	before(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
		await new Promise((r) => setTimeout(r, INIT_HEALING_WAIT_MS));
	});

	// it("root file gets no suffix", testRootFileNoSuffix);
	// it("nested file gets suffix added", testNestedFileGetsSuffix);
	// it("file with correct suffix is no-op", testFileWithCorrectSuffixNoOp);
	// it("file with wrong suffix is healed", testFileWithWrongSuffixHealed);
});

