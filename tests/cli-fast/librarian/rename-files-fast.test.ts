import { beforeAll, describe, expect, it } from "bun:test";
import { prepareFastSuite } from "../infra";
import {
	createFastRenameFilesFixture,
	expectFastRenameFilesHealing,
	performFastRenameFilesMutation,
	resetFastRenameFilesFixture,
} from "./rename-files-fast/fixture";

const hasCliEnv = Boolean(
	process.env.CLI_E2E_VAULT && process.env.CLI_E2E_VAULT_PATH,
);

describe("Librarian CLI Fast - rename files", () => {
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

	it("heals descendant paths after the legacy folder rename sequence", async () => {
		const startedAt = performance.now();

		await resetFastRenameFilesFixture();
		await createFastRenameFilesFixture();
		await performFastRenameFilesMutation();
		await expectFastRenameFilesHealing();

		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log(`[cli-fast] rename-files scenario finished in ${elapsedMs}ms`);

		expect(elapsedMs).toBeGreaterThan(0);
	});
});
