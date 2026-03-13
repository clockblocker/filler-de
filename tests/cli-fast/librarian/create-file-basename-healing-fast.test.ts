import { beforeAll, describe, expect, it } from "bun:test";
import { prepareFastSuite } from "../infra";
import {
	createFastCreateFileBasenameHealingFixture,
	expectFastCreateFileBasenameHealing,
	resetFastCreateFileBasenameHealingFixture,
} from "./create-file-basename-healing-fast/fixture";

const hasCliEnv = Boolean(
	process.env.CLI_E2E_VAULT && process.env.CLI_E2E_VAULT_PATH,
);

describe("Librarian CLI Fast - create file basename healing", () => {
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

	it("heals a new unsuffixed file and adds a single go-back link", async () => {
		const startedAt = performance.now();

		await resetFastCreateFileBasenameHealingFixture();
		await createFastCreateFileBasenameHealingFixture();
		await expectFastCreateFileBasenameHealing();

		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log(
			`[cli-fast] create-file-basename-healing scenario finished in ${elapsedMs}ms`,
		);

		expect(elapsedMs).toBeGreaterThan(0);
	});
});
