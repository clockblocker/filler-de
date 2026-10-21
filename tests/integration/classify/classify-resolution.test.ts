/**
 * The `classify-resolution` desktop scenario's story without Obsidian: the
 * plugin's dumgen host with the scenario's script, the real resolver, the
 * dictionary store over a fake vault and the Scroll in memory. It proves
 * the scripted dumgen resolves the noun, the separable verb and the
 * Locution through the real dumgen, so the desktop scenario tests the
 * Obsidian side only.
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
import {
	CLASSIFY_RESOLUTION_DUMGEN,
	FIRST_SELECTION,
	LEMMA_PATHS,
	SECOND_SELECTION,
	STORY,
} from "../../obsidian-e2e/scenarios/classify-resolution-script";
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

const KNOWLEDGE_STAGES = ["transcription", "definition", "translations"];

describe("Classify resolves a selection end to end", () => {
	it("links the noun, the separable verb and the Locution, then re-encounters the noun without Knowledge calls", async () => {
		const host = new DumgenHost({
			fetch: () => Promise.reject(new Error("no provider in tests")),
			keys: () => ({ openaiApiKey: "", typesafeApiKey: "" }),
		});
		host.useScriptedDumgenForTesting({
			jev: answersOf(CLASSIFY_RESOLUTION_DUMGEN.jev),
			luna: CLASSIFY_RESOLUTION_DUMGEN.luna,
		});
		const vault = new FakeVault();
		const store = await Effect.runPromise(makeDumdictVaultStore({ vault }));
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
		};

		await classify(FIRST_SELECTION);
		const first = commander.latestHandoff();
		expect(first?.resolutions).toEqual([
			"Resolved",
			"Resolved",
			"Resolved",
			"Resolved",
		]);
		/** The Reading note of the one Reading of the Lemma note at `path`. */
		const readingNoteOf = async (path: string) => {
			const note = await Effect.runPromise(store.lemmaNotes);
			const lemma = note.find((entry) => entry.path === path)?.lemma;
			if (!lemma) throw new Error(`No Lemma note at ${path}`);
			const stored = await Effect.runPromise(store.lemmaNote(lemma));
			const reading = stored?.readings[0]?.reading;
			if (!reading) throw new Error(`No Reading at ${path}`);
			const location = await Effect.runPromise(store.readingLocation(reading));
			if (!location) throw new Error(`No Reading note for ${path}`);
			return location.path;
		};
		const link = async (path: string, shown: string) =>
			`[[${(await readingNoteOf(path)).slice(0, -3)}|${shown}]]`;
		expect(scroll.content).toBe(
			`${await link(LEMMA_PATHS.hund, "Der Hund")} ${await link(LEMMA_PATHS.anfangen, "fängt")} ${await link(LEMMA_PATHS.heute, "heute")} ${await link(LEMMA_PATHS.aufJedenFall, "auf jeden Fall")} ${await link(LEMMA_PATHS.anfangen, "an")}. ^0\n\nDer Hund schläft. ^1\n`,
		);
		// Each Reading note shows its occurrence under Deine Kontexte.
		for (const path of Object.values(LEMMA_PATHS))
			expect(vault.content(await readingNoteOf(path))).toMatch(
				/!\[\[Story#\^0\|\^[0-9a-f]{8}\]\]/u,
			);
		const knowledgeCalls = () =>
			KNOWLEDGE_STAGES.map(
				(stage) => host.scriptedRequests()?.luna[stage] ?? 0,
			);
		const before = knowledgeCalls();
		expect(before.every((count) => count > 0)).toBe(true);

		await classify(SECOND_SELECTION);
		const hund = commander.latestHandoff()?.resolved[0];
		expect(hund).toMatchObject({
			linked: 1,
			readingPath: await readingNoteOf(LEMMA_PATHS.hund),
		});
		expect(vault.content(await readingNoteOf(LEMMA_PATHS.hund))).toMatch(
			/!\[\[Story#\^1\|\^[0-9a-f]{8}\]\]/u,
		);
		expect(knowledgeCalls()).toEqual(before);
	});
});
