import { beforeAll, describe, expect, it } from "bun:test";
import { prepareFastSuite } from "../infra";
import {
	createFastRenameCorenameFixture,
	expectFastRenameCorenameHealing,
	performFastRenameCorenameMutation,
	resetFastRenameCorenameFixture,
} from "./rename-corename-fast/fixture";

const hasCliEnv = Boolean(
	process.env.CLI_E2E_VAULT && process.env.CLI_E2E_VAULT_PATH,
);

describe("Librarian CLI Fast - rename corename", () => {
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

	it("keeps the codex synced after multiple same-folder core name renames", async () => {
		const startedAt = performance.now();

		await resetFastRenameCorenameFixture();
		await createFastRenameCorenameFixture();
		await performFastRenameCorenameMutation();
		await expectFastRenameCorenameHealing();

		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log(`[cli-fast] rename-corename scenario finished in ${elapsedMs}ms`);

		expect(elapsedMs).toBeGreaterThan(0);
	});
});
