import { beforeAll, describe, expect, it } from "bun:test";
import {
	deleteExactFile,
	prepareFastSuite,
	waitForPluginIdleFast,
} from "../infra";
import {
	createFastDeleteFileFixture,
	expectFastDeleteFileHealing,
	FAST_DELETE_FILE_FIXTURE,
	resetFastDeleteFileFixture,
} from "./delete-file-fast/fixture";

const hasCliEnv = Boolean(
	process.env.CLI_E2E_VAULT && process.env.CLI_E2E_VAULT_PATH,
);

describe("Librarian CLI Fast - delete file", () => {
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

	it("updates the local codex after deleting a file from a minimal fixture", async () => {
		const startedAt = performance.now();

		await resetFastDeleteFileFixture();
		await createFastDeleteFileFixture();
		await deleteExactFile(FAST_DELETE_FILE_FIXTURE.ingredientsPath);
		await waitForPluginIdleFast();
		await expectFastDeleteFileHealing();

		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log(`[cli-fast] delete-file scenario finished in ${elapsedMs}ms`);

		expect(elapsedMs).toBeGreaterThan(0);
	});
});
