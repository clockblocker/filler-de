/**
 * The `classify-licence-groups` desktop scenario's story without Obsidian:
 * the plugin's dumgen host with the scenario's script, the real resolver,
 * and the dictionary store over a fake vault with the plugin's
 * projections. It proves the script gives Mutter two Readings whose
 * plurals differ, so the desktop scenario tests the Obsidian side only.
 */
import { describe, expect, it } from "bun:test";
import { makeDumdictVaultStore } from "@textfresser/dictionary";
import type { Answer } from "dumgen";
import { Effect } from "effect";
import { ClassifyCommander } from "../../../src/commanders/classify/classify-commander";
import { dumgenUnitResolver } from "../../../src/commanders/classify/resolution/dumgen-unit-resolver";
import { createKnowledgeQueue } from "../../../src/commanders/classify/resolution/knowledge-queue";
import { produceKnowledge } from "../../../src/commanders/classify/resolution/produce-knowledge";
import { memorySegmentationCache } from "../../../src/commanders/classify/segmentation-cache";
import { DumgenHost } from "../../../src/managers/dumgen";
import { FakeVault } from "../../../src/packages/composed/dictionary/tests/support/fake-vault";
import { dictionaryProjections } from "../../../src/stateless-helpers/dictionary-projections";
import {
	expectLicenceGroupNotes,
	LICENCE_GROUPS_DUMGEN,
	NUT_PATH,
	NUT_SELECTION,
	PARENT_PATH,
	PARENT_SELECTION,
	STORY,
} from "../../obsidian-e2e/scenarios/classify-licence-groups-script";
import { linkTo } from "../../obsidian-e2e/scenarios/dictionary-layout";
import { MemoryScroll } from "../../unit/classify/resolution/support";

const SCROLL = "Library/Story.md";

/** The driver's expansion of a scenario's jev script into dumgen Answers. */
function answersOf(
	script: Readonly<Record<string, string | number>>,
): Record<string, Answer> {
	return Object.fromEntries(
		Object.entries(script).map(([id, answer]) => [
			id,
			typeof answer === "number"
				? { noul: answer, type: "noul" }
				: {
						choice: answer,
						confidence: 1,
						probabilities: { [answer]: 1 },
						type: "choice",
					},
		]),
	);
}

describe("Classify gives each Licence Group its own table", () => {
	it("draws one table per Licence Group of Mutter, and each Reading note embeds its own", async () => {
		const host = new DumgenHost({
			fetch: () => Promise.reject(new Error("no provider in tests")),
			keys: () => ({ openaiApiKey: "", typesafeApiKey: "" }),
		});
		host.useScriptedDumgenForTesting({
			jev: answersOf(LICENCE_GROUPS_DUMGEN.jev),
			luna: LICENCE_GROUPS_DUMGEN.luna,
		});
		const vault = new FakeVault();
		const store = await Effect.runPromise(
			makeDumdictVaultStore({ projections: dictionaryProjections, vault }),
		);
		const scroll = new MemoryScroll(SCROLL, STORY);
		const notices: string[] = [];
		const queue = createKnowledgeQueue({
			notify: (message) => notices.push(message),
			run: (job) =>
				produceKnowledge(
					{ dumgen: host.get(), store, translationLanguages: ["en", "ru"] },
					job,
				),
		});
		const commander = new ClassifyCommander({
			cache: memorySegmentationCache(),
			dumgen: () => host.get(),
			missingProviderKeys: () => host.missingKeys(),
			resolver: dumgenUnitResolver({
				dumgen: Effect.sync(() => host.get()),
				knowledge: queue,
				notify: (message) => notices.push(message),
				scroll,
				store: Effect.succeed(store),
			}),
			segmenterVersion: () => "test-segmenter",
		});
		const classify = async (selection: string) => {
			const from = scroll.content.indexOf(selection);
			await Effect.runPromise(
				commander.execute(
					{
						content: scroll.content,
						scrollPath: SCROLL,
						selection: { from, to: from + selection.length },
					},
					(message) => notices.push(message),
				),
			);
			await queue.whenIdle();
			return commander.latestHandoff()?.resolved;
		};

		expect(await classify(PARENT_SELECTION)).toEqual([
			{ linked: 1, readingPath: PARENT_PATH },
		]);
		expect(await classify(NUT_SELECTION)).toEqual([
			{ linked: 1, readingPath: NUT_PATH },
		]);
		expect(scroll.content).toBe(
			`${linkTo(PARENT_PATH, "Die Mutter")} lacht. ^0\n\n${linkTo(NUT_PATH, "Eine Mutter")} klemmt. ^1\n`,
		);
		expectLicenceGroupNotes(
			Object.fromEntries(
				vault.markdownPaths().map((path) => [path, vault.content(path)]),
			),
		);
		// The licence judge was asked about the stored plural, once.
		expect(host.scriptedRequests()?.jev.paradigmLicence).toBe(1);
	});
});
