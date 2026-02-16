import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { setupTestVault } from "../setup";
import { readFile, reloadPlugin, waitForIdle } from "../utils";
import {
	assertNoNestedWikilinks,
	assertSurfaceLinked,
	findTargetForSurface,
	installTextfresserE2EStubs,
	prepareSourceFile,
	readSourceFile,
	resolveTargetMdPath,
	runLemma,
	SCENARIOS,
} from "./helpers";

describe("Textfresser CLI E2E P0 stabilization", () => {
	beforeAll(async () => {
		await setupTestVault();
	});

	beforeEach(async () => {
		await reloadPlugin();
		await waitForIdle(20_000);
		await installTextfresserE2EStubs();
	});

	it("keeps reruns idempotent without nested wikilinks", async () => {
		await prepareSourceFile();
		await waitForIdle(20_000);

		const cases = [
			SCENARIOS.N2_A,
			SCENARIOS.N3_B,
			SCENARIOS.V1_A,
			SCENARIOS.P1_A,
			SCENARIOS.A1_A,
		];

		for (const surface of cases) {
			await runLemma(surface);
			await runLemma(surface);
			await waitForIdle(120_000);
		}

		const source = await readSourceFile();
		for (const surface of cases) {
			assertSurfaceLinked(source, surface);
		}
		assertNoNestedWikilinks(source);
	});

	it("waitForIdle resolves only after Lemma source rewrite is visible", async () => {
		await prepareSourceFile();
		await waitForIdle(20_000);

		await runLemma(SCENARIOS.N2_A);
		await waitForIdle(120_000);

		const source = await readSourceFile();
		assertSurfaceLinked(source, SCENARIOS.N2_A);
	});

	it("runs latest pending background generate and leaves second target non-empty", async () => {
		await prepareSourceFile();
		await waitForIdle(20_000);

		await runLemma(SCENARIOS.A1_A);
		await runLemma(SCENARIOS.A1_B);
		await waitForIdle(180_000);

		const source = await readSourceFile();
		const secondTarget = findTargetForSurface(source, SCENARIOS.A1_B);
		expect(secondTarget).toBeTruthy();
		if (!secondTarget) {
			return;
		}

		const targetPath = await resolveTargetMdPath(secondTarget);
		const targetContent = await readFile(targetPath);
		expect(targetContent.trim().length).toBeGreaterThan(0);
		expect(targetContent).toContain("DictEntry");
		expect(targetContent).toContain("entry_section_title");
	});
});
