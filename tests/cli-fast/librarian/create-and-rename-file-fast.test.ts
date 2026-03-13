import { beforeAll, describe, expect, it } from "bun:test";
import { prepareFastSuite, renameExactFile, waitFor } from "../infra";
import {
	createFastCreateAndRenameFileFixture,
	expectFastCreateAndRenameFileHealing,
	FAST_CREATE_AND_RENAME_FILE_FIXTURE,
	resetFastCreateAndRenameFileFixture,
} from "./create-and-rename-file-fast/fixture";

const hasCliEnv = Boolean(
	process.env.CLI_E2E_VAULT && process.env.CLI_E2E_VAULT_PATH,
);

describe("Librarian CLI Fast - create and rename file", () => {
	if (!hasCliEnv) {
		it("requires CLI_E2E_VAULT and CLI_E2E_VAULT_PATH", () => {
			console.log(
				"[cli-fast] Skipping because CLI_E2E_VAULT or CLI_E2E_VAULT_PATH is not set.",
			);
		});
		return;
	}

	beforeAll(async () => {
		await prepareFastSuite();
	});

	it("updates the local codex after a same-folder CLI rename", async () => {
		const startedAt = performance.now();

		await resetFastCreateAndRenameFileFixture();
		await createFastCreateAndRenameFileFixture();
		await renameExactFile(
			FAST_CREATE_AND_RENAME_FILE_FIXTURE.originalPath,
			FAST_CREATE_AND_RENAME_FILE_FIXTURE.renamedName,
		);
		await waitFor("short");
		await expectFastCreateAndRenameFileHealing();

		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log(
			`[cli-fast] create-and-rename-file scenario finished in ${elapsedMs}ms`,
		);

		expect(elapsedMs).toBeGreaterThan(0);
	});
});
