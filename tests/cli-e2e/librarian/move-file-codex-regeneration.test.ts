import { beforeAll, describe, it } from "bun:test";
import { setupTestVault } from "../setup";
import { waitForIdle } from "../utils";
import {
	performMutation011,
	testPostHealing011,
} from "./chains/3-chain/011-move-file-cli-codex";

describe("Librarian CLI E2E - file move codex regeneration", () => {
	beforeAll(async () => {
		await setupTestVault();
	});

	it("regenerates old and new parent codexes after moving a file via CLI", async () => {
		await performMutation011();
		await waitForIdle();
		await testPostHealing011();
	});
});
