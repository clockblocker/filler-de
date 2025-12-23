/// <reference types="@wdio/globals/types" />
import { browser, expect } from "@wdio/globals";
import type { HelpersTestingApi, Result } from "./utils";

export const testUpsertMdFileRaceConditions = async () => {
	const results = await browser.executeObsidian(async ({ app }: any) => {
		const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]?.getHelpersTestingApi?.() as HelpersTestingApi | undefined;
		if (!api) throw new Error("testing api unavailable");

		const { tfileHelper, splitPath } = api;

		// Test: Multiple concurrent creates → one succeeds, others get existing
		const fileSplitPath = splitPath("race-test.md");
		
		// Create file 3 times concurrently
		const [create1, create2, create3] = await Promise.all([
			tfileHelper.upsertMdFile({
				content: "# First",
				splitPath: fileSplitPath,
			}) as unknown as Promise<Result<{ name: string; path: string }>>,
			tfileHelper.upsertMdFile({
				content: "# Second",
				splitPath: fileSplitPath,
			}) as unknown as Promise<Result<{ name: string; path: string }>>,
			tfileHelper.upsertMdFile({
				content: "# Third",
				splitPath: fileSplitPath,
			}) as unknown as Promise<Result<{ name: string; path: string }>>,
		]);

		const concurrentResults = {
			allOk: create1.isOk() && create2.isOk() && create3.isOk(),
			allSamePath: create1.value?.path === create2.value?.path && create2.value?.path === create3.value?.path,
			path1: create1.value?.path,
			path2: create2.value?.path,
			path3: create3.value?.path,
		};

		// Test: File created between check and create → handles gracefully
		// Simulate by creating file externally, then trying to create again
		const externalFileSplitPath = splitPath("external-race.md");
		
		// Create file using Obsidian API directly (external creation)
		await app.vault.create("external-race.md", "# External");
		
		// Now try to create via helper (should return existing)
		const createAfterExternal = await tfileHelper.upsertMdFile({
			content: "# Should not overwrite",
			splitPath: externalFileSplitPath,
		}) as unknown as Result<{ name: string; path: string }>;

		// Verify original content preserved
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const externalContent = await app.vault.read(createAfterExternal.value as any);

		const externalRaceResult = {
			content: externalContent,
			expectedContent: "# External",
			isOk: createAfterExternal.isOk(),
			path: createAfterExternal.value?.path,
		};

		return { concurrentResults, externalRaceResult };
	});

	// Verify concurrent creates all succeed and return same file
	expect(results.concurrentResults.allOk).toBe(true);
	expect(results.concurrentResults.allSamePath).toBe(true);
	expect(results.concurrentResults.path1).toBe("race-test.md");

	// Verify external creation is handled gracefully
	expect(results.externalRaceResult.isOk).toBe(true);
	expect(results.externalRaceResult.path).toBe("external-race.md");
	// Original content should be preserved (race condition handled)
	expect(results.externalRaceResult.content).toBe(results.externalRaceResult.expectedContent);
};
