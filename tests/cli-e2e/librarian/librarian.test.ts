import { beforeAll, describe, it } from "bun:test";
import { setupTestVault } from "../setup";
import { waitForIdle } from "../utils";
import {
	testAllCodexesCreatedOnInit,
	testAllFilesSuffixedOnInit,
} from "./chains/0-chain/000-init";
import {
	performMutation001,
	testPostHealing001,
} from "./chains/0-chain/001-create-more-files";
import {
	performMutation002,
	testPostHealing002,
} from "./chains/0-chain/002-rename-files";
import {
	performMutation003,
	testPostHealing003,
} from "./chains/0-chain/003-create-and-rename-a-file";
import {
	performMutation004,
	testPostHealing004,
} from "./chains/1-chain/004-delete-file";
import {
	performMutation005,
	testPostHealing005,
} from "./chains/1-chain/005-delete-folder";
import {
	performMutation006,
	testPostHealing006,
} from "./chains/1-chain/006-rename-corename";
import {
	performMutation007,
	testPostHealing007,
} from "./chains/1-chain/007-create-file-basename-healing";
import {
	performMutation008,
	testPostHealing008,
} from "./chains/2-chain/008-toggle-scroll-checkbox";
import {
	performMutation009,
	testPostHealing009,
} from "./chains/2-chain/009-toggle-section-checkbox";

describe("Librarian CLI E2E", () => {
	beforeAll(async () => {
		await setupTestVault();
	});

	// 000: Initial healing
	it("creates all codex files on init", testAllCodexesCreatedOnInit);
	it("all files are healed to canonical suffixes on init", testAllFilesSuffixedOnInit);

	// 001: Create more files
	it("creates additional files after mutation", async () => {
		await performMutation001();
		await waitForIdle();
	});
	it("heals all files to canonical suffixes after mutation", testPostHealing001);

	// 002: Rename files (folder renames with hyphen semantics)
	it("renames folders for 002", async () => {
		await performMutation002();
		await waitForIdle();
	});
	it("heals all files after folder renames", testPostHealing002);

	// 003: Create and rename a file
	it("creates and renames a file for 003", async () => {
		await performMutation003();
		await waitForIdle();
	});
	it("codex should reflect renamed file", testPostHealing003);

	// 004: Delete a single file
	it("deletes file for 004", async () => {
		await performMutation004();
		await waitForIdle();
	});
	it("codex no longer refs deleted file", testPostHealing004);

	// 005: Delete a folder
	it("deletes folder for 005", async () => {
		await performMutation005();
		await waitForIdle();
	});
	it("codexes no longer ref deleted folder", testPostHealing005);

	// 006: Multiple back-to-back coreName renames
	it("creates and renames coreName for 006", async () => {
		await performMutation006();
		await waitForIdle();
	});
	it("codex should show new coreName after rename", testPostHealing006);

	// 007: Create file without suffix - verify basename healing + go-back link
	it("creates a new file without suffix for 007", async () => {
		await performMutation007();
		await waitForIdle();
	});
	it("new file should be renamed to include suffix", testPostHealing007);

	// 008: Toggle scroll checkbox to Done
	it("toggles Steps checkbox in Fish codex", async () => {
		await performMutation008();
		await waitForIdle();
	});
	it("Fish codex shows checked Steps, Pie codex shows checked Fish", testPostHealing008);

	// 009: Toggle section checkbox to Done (propagation)
	it("toggles Berry section checkbox in Pie codex", async () => {
		await performMutation009();
		await waitForIdle();
	});
	it("Berry scrolls all checked, Pie codex shows checked Berry", testPostHealing009);
});
