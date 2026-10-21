import { describe, expect, it } from "bun:test";
import type { DumdictVaultStore } from "@textfresser/dictionary";
import type { Unit } from "dumgen";
import { createDumgen } from "dumgen";
import type * as Dumling from "dumling/types";
import { Effect, Layer } from "effect";
import {
	ClassifyCommander,
	missingKeysNotice,
} from "../../../../src/commanders/classify/classify-commander";
import {
	ClassifySegmenter,
	classifySelection,
} from "../../../../src/commanders/classify/classify-selection";
import { dumgenUnitResolver } from "../../../../src/commanders/classify/resolution/dumgen-unit-resolver";
import { createKnowledgeQueue } from "../../../../src/commanders/classify/resolution/knowledge-queue";
import {
	memorySegmentationCache,
	SegmentationCache,
} from "../../../../src/commanders/classify/segmentation-cache";
import { UnitResolver } from "../../../../src/commanders/classify/unit-resolver";
import { createScriptedJev } from "../../../../src/managers/dumgen/scripted-jev";
import { FAENGT_AN_ANSWERS, selectionOf } from "../support";
import {
	attestationOf,
	baseTextKnowledge,
	planFor,
	resolutionHarness,
	run,
	stubDumgen,
	unit,
} from "./support";

const SCROLL = "Library/Story.md";

const see = unit({
	canonicalForm: "See",
	coreFeatures: { gender: "Masc" },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
} as Dumling.Lemma<"de">);

const anfangen = unit({
	canonicalForm: "anfangen",
	coreFeatures: { hasSepPrefix: "an", lexicallyReflexive: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
} as Dumling.Lemma<"de">);

const aufJedenFall = unit({
	canonicalForm: "auf jeden Fall",
	coreFeatures: { comparable: null },
	family: "Locution",
	kind: "ADV",
	language: "de",
	unitKind: "Lemma",
} as Dumling.Lemma<"de">);

const route = (family: string, kind: string) =>
	({ family, kind, language: "de" }) as Unit["route"];

const NOUN_EVIDENCE = { articleEvidence: null, valencyEvidence: [] };

const SEE_PATH = "Worter/de/Lexeme/NOUN/Masc/See.md";

/** A grammar stub that resolves `See` and leaves every other unit unresolved. */
const seeGrammar = (input: { readonly unit: Unit }) =>
	input.unit.route !== "Unresolved" && input.unit.route.kind === "NOUN"
		? ({
				_tag: "Resolved",
				attestation: attestationOf(see, "See", ["See"], NOUN_EVIDENCE),
			} as const)
		: ({ _tag: "Unresolved" } as const);

const seeUnits: Unit[] = [{ route: route("Lexeme", "NOUN"), segments: [2] }];

describe("dumgenUnitResolver", () => {
	it("commits a German noun's New Reading, links its Segment and publishes its Knowledge", async () => {
		const content = "Der See ist tief. ^0\n";
		const { calls, dumgen } = stubDumgen({
			grammar: seeGrammar,
			knowledge: baseTextKnowledge,
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
		const resolutions = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);

		const note = await run(harness.store.lemmaNote(see));
		expect(note?.path).toBe(SEE_PATH);
		const entry = note?.readings[0];
		// TODO(#113): the occurrences' Attestation Links, once the store keeps them.
		expect(entry?.attestationLinks).toEqual([]);
		expect(entry?.knowledge?.definition).toBe("See, defined");
		expect(note?.ownedSurfaces.map(({ surface }) => surface.normalizedSurface)).toEqual(["See"]);

		const [resolution] = resolutions;
		if (resolution?._tag !== "Resolved") throw new Error("See did not resolve");
		expect(resolution.lemmaPath).toBe(SEE_PATH);
		expect(resolution.readingBlockId).toMatch(/^r-[0-9a-f]{8}$/);
		expect(resolution.linked).toBe(1);
		expect(harness.scroll.content).toBe(
			`Der [[Worter/de/Lexeme/NOUN/Masc/See#^${resolution.readingBlockId}|See]] ist tief. ^0\n`,
		);
		expect(calls.reading[0]?.candidates).toEqual([]);
		expect(calls.knowledge).toHaveLength(1);
		expect(calls.knowledge[0]?.origin).toBe("New");
		expect(harness.notices).toEqual(["✓ Knowledge for See 🌊 saved"]);
	});

	it("re-encounters the same sense: appends its Attestation and asks no Knowledge", async () => {
		const content = "Der See ist tief. ^0\n\nDer See ist kalt. ^1\n";
		const stub = stubDumgen({
			grammar: seeGrammar,
			knowledge: baseTextKnowledge,
			reading: (input) =>
				input.candidates.includes("🌊")
					? { _tag: "Reuse", emojiDescription: "🌊" }
					: { _tag: "New", emojiDescription: "🌊" },
		});
		const harness = await resolutionHarness({ content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		expect(stub.calls.knowledge).toHaveLength(1);

		const second = await harness.resolve(
			planFor({
				content: harness.scroll.content,
				scrollPath: SCROLL,
				sentenceText: "Der See ist kalt.",
				units: seeUnits,
			}),
		);
		expect(second[0]?._tag).toBe("Resolved");
		expect(stub.calls.reading[1]?.candidates).toEqual(["🌊"]);
		const note = await run(harness.store.lemmaNote(see));
		expect(note?.readings).toHaveLength(1);
		// TODO(#113): the occurrences' Attestation Links, once the store keeps them.
		expect(note?.readings[0]?.attestationLinks).toEqual([]);
		// The stored entry covers what a later occurrence may ask: no model call.
		expect(stub.calls.knowledge).toHaveLength(1);
		expect(harness.scroll.content.match(/\[\[Worter\/de\/Lexeme\/NOUN\/Masc\/See#\^r-/gu)).toHaveLength(2);

		// The very same occurrence again changes nothing.
		const before = harness.vault.batches.length;
		await harness.resolve(
			planFor({
				content: "Der See ist kalt. ^1\n",
				scrollPath: SCROLL,
				sentenceText: "Der See ist kalt.",
				units: seeUnits,
			}),
		);
		expect(harness.vault.batches.length).toBe(before);
	});

	it("links every piece of a separable verb to one Reading, segmented through Classify", async () => {
		const content = "Er fängt heute an.\n";
		const stub = stubDumgen({
			grammar: (input) =>
				input.unit.route !== "Unresolved" && input.unit.route.kind === "VERB"
					? {
							_tag: "Resolved",
							attestation: attestationOf(anfangen, "fängt an", ["fängt", "an"], {
								expletiveEvidence: null,
								valencyEvidence: [],
							}),
						}
					: { _tag: "Unresolved" },
			reading: () => ({ _tag: "New", emojiDescription: "🏁" }),
		});
		const harness = await resolutionHarness({
			content,
			dumgen: stub.dumgen,
			scrollPath: SCROLL,
		});
		const segmenter = createDumgen({
			jev: createScriptedJev(FAENGT_AN_ANSWERS).ask,
			luna: () => Promise.reject(new Error("segmentation asked Luna")),
		});
		const resolver = dumgenUnitResolver({
			dumgen: Effect.succeed(stub.dumgen),
			knowledge: harness.queue,
			scroll: harness.scroll,
			store: Effect.succeed(harness.store),
		});
		const outcome = await run(
			classifySelection({
				content,
				scrollPath: SCROLL,
				selection: selectionOf(content, "an."),
			}).pipe(
				Effect.provide(
					Layer.mergeAll(
						Layer.succeed(SegmentationCache, memorySegmentationCache()),
						Layer.succeed(UnitResolver, resolver),
						Layer.succeed(ClassifySegmenter, {
							dumgen: Effect.succeed(segmenter),
							segmenterVersion: "test-segmenter",
						}),
					),
				),
			),
		);
		await harness.queue.whenIdle();
		const [resolution] = outcome.resolutions;
		if (resolution?._tag !== "Resolved") throw new Error("anfangen did not resolve");
		expect(resolution.lemmaPath).toBe("Worter/de/Lexeme/VERB/an/anfangen.md");
		expect(resolution.linked).toBe(2);
		const link = (shown: string) =>
			`[[Worter/de/Lexeme/VERB/an/anfangen#^${resolution.readingBlockId}|${shown}]]`;
		// The block had no ID: the Attestation Ref minted one.
		expect(harness.scroll.content).toBe(`Er ${link("fängt")} heute ${link("an")}. ^0\n`);
		const note = await run(harness.store.lemmaNote(anfangen));
		// TODO(#113): the occurrences' Attestation Links, once the store keeps them.
		expect(note?.readings[0]?.attestationLinks).toEqual([]);
	});

	it("publishes generated relations, Pending ones in their source note only, in commits of capped size", async () => {
		const content = "Der See ist tief. ^0\n";
		const targets = Array.from({ length: 60 }, (_, index) => `Teich${index}`);
		const { dumgen } = stubDumgen({
			grammar: seeGrammar,
			knowledge: (input) => ({
				...baseTextKnowledge(input),
				pendingRelations: targets.map((canonicalForm) => ({
					relation: "synonym" as const,
					target: {
						canonicalForm,
						family: "Lexeme" as const,
						kind: "NOUN" as const,
						language: "de" as const,
					},
				})),
			}),
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const planned: number[] = [];
		const harness = await resolutionHarness({
			content,
			dumgen,
			scrollPath: SCROLL,
			wrapStore: (store) => ({
				...store,
				commitChanges: (request) => {
					planned.push(request.changes.length);
					return store.commitChanges(request);
				},
			}),
		});
		await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		const note = await run(harness.store.lemmaNote(see));
		expect(note?.pendingRelations).toHaveLength(60);
		expect(Math.max(...planned)).toBeLessThanOrEqual(50);
		const notePath = note?.path ?? "";
		expect(harness.vault.markdownPaths().filter((path) => path.startsWith("Worter/"))).toEqual([notePath]);
		expect(harness.vault.content(notePath)).toContain("[[Worter/t/tei/teich/teich7|Teich7]]");
		expect(harness.notices).toEqual(["✓ Knowledge for See 🌊 saved"]);
	});

	it("links a Locution's words as one link", async () => {
		const content = "Er kommt auf jeden Fall. ^3\n";
		const { dumgen } = stubDumgen({
			grammar: () => ({
				_tag: "Resolved",
				attestation: attestationOf(aufJedenFall, "auf jeden Fall", ["auf", "jeden", "Fall"]),
			}),
			reading: () => ({ _tag: "New", emojiDescription: "✅" }),
		});
		const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
		const [resolution] = await harness.resolve(
			planFor({
				content,
				scrollPath: SCROLL,
				sentenceText: "Er kommt auf jeden Fall.",
				units: [{ route: route("Locution", "ADV"), segments: [4, 6, 8] }],
			}),
		);
		if (resolution?._tag !== "Resolved") throw new Error("the Locution did not resolve");
		expect(resolution.lemmaPath).toBe("Worter/de/Locution/ADV/auf jeden Fall.md");
		expect(harness.scroll.content).toBe(
			`Er kommt [[Worter/de/Locution/ADV/auf jeden Fall#^${resolution.readingBlockId}|auf jeden Fall]]. ^3\n`,
		);
	});

	it("judges a stale New again over the Readings its Lemma gained meanwhile", async () => {
		const content = "Der See ist tief. ^0\n";
		let store: DumdictVaultStore | undefined;
		const stub = stubDumgen({
			grammar: seeGrammar,
			reading: async (input) => {
				if (input.written !== undefined)
					return { _tag: "New", emojiDescription: input.written };
				// Another Classify stores ⛵ while this judge decides.
				if (store) await seedReading(store, "⛵");
				return { _tag: "New", emojiDescription: "🌊" };
			},
		});
		const harness = await resolutionHarness({
			content,
			dumgen: stub.dumgen,
			scrollPath: SCROLL,
		});
		store = harness.store;
		const resolutions = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		expect(stub.calls.reading).toHaveLength(2);
		expect(stub.calls.reading[1]?.candidates).toEqual(["⛵"]);
		expect(stub.calls.reading[1]?.written).toBe("🌊");
		expect(resolutions[0]?._tag).toBe("Resolved");
		const note = await run(harness.store.lemmaNote(see));
		expect(
			note?.readings
				.map(({ reading }) =>
					"emojiDescription" in reading ? reading.emojiDescription : "",
				)
				.sort(),
		).toEqual(["🌊", "⛵"].sort());
	});

	it("re-plans and retries a commit that lost a revision race", async () => {
		const content = "Der See ist tief. ^0\n";
		let commits = 0;
		const { dumgen } = stubDumgen({
			grammar: seeGrammar,
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const harness = await resolutionHarness({
			content,
			dumgen,
			scrollPath: SCROLL,
			wrapStore: (store) => ({
				...store,
				commitChanges: (request) =>
					Effect.gen(function* () {
						commits++;
						if (commits === 1) {
							// Another writer commits first, so this plan's revision is stale.
							const revision = yield* store.revision;
							yield* store.commitChanges({
								baseRevision: revision,
								changes: [
									{
										preconditions: [{ kind: "lemmaMissing", lemma: anfangen }],
										record: { lemma: anfangen },
										type: "createLemma",
									},
								],
							});
						}
						return yield* store.commitChanges(request);
					}),
			}),
		});
		const [resolution] = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		expect(commits).toBe(2);
		expect(resolution?._tag).toBe("Resolved");
		expect((await run(harness.store.lemmaNote(see)))?.readings).toHaveLength(1);
	});

	it("keeps the user's typing and skips an occurrence they changed", async () => {
		const content = "Der See ist tief. ^0\n";
		const { dumgen } = stubDumgen({
			grammar: seeGrammar,
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
		harness.scroll.beforeWrite = (current) => `Titel\n\n${current}Neu getippt.\n`;
		harness.scroll.conflictsLeft = 1;
		const [resolution] = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		if (resolution?._tag !== "Resolved") throw new Error("See did not resolve");
		expect(harness.scroll.content).toBe(
			`Titel\n\nDer [[Worter/de/Lexeme/NOUN/Masc/See#^${resolution.readingBlockId}|See]] ist tief. ^0\nNeu getippt.\n`,
		);

		harness.scroll.content = "Der Seehund ist tief. ^0\n";
		const [again] = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		expect(again?._tag === "Resolved" && again.linked).toBe(0);
		expect(harness.scroll.content).toBe("Der Seehund ist tief. ^0\n");
		expect(harness.notices.some((notice) => notice.includes("unlinked"))).toBe(true);
	});

	it("leaves a unit dumgen cannot resolve Pending and writes nothing for it", async () => {
		const content = "Der See ist tief. ^0\n";
		const { dumgen } = stubDumgen({
			grammar: () => ({ _tag: "Unresolved" }),
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const harness = await resolutionHarness({ content, dumgen, scrollPath: SCROLL });
		const [resolution] = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		expect(resolution).toMatchObject({
			_tag: "Pending",
			reason: "dumgen left its grammar unresolved",
		});
		expect(harness.scroll.writes).toHaveLength(0);
		expect(harness.vault.batches).toHaveLength(0);
	});
});

describe("Classify without provider keys", () => {
	it("tells the user which key is missing and asks no provider", async () => {
		let asked = 0;
		const notices: string[] = [];
		const commander = new ClassifyCommander({
			cache: memorySegmentationCache(),
			dumgen: () => {
				asked++;
				throw new Error("no dumgen without keys");
			},
			missingProviderKeys: () => ["OpenAI"],
			resolver: {
				resolve: () => Effect.die(new Error("resolution ran without keys")),
			},
			segmenterVersion: () => "test-segmenter",
		});
		await run(
			commander.execute(
				{ content: "Er fängt heute an.\n", scrollPath: SCROLL, selection: { from: 0, to: 2 } },
				(message) => notices.push(message),
			),
		);
		expect(notices).toEqual([
			"⚠ Classify needs an OpenAI API key. Add it in Textfresser's settings.",
		]);
		expect(asked).toBe(0);
		expect(missingKeysNotice(["TypeSafe", "OpenAI"])).toBe(
			"⚠ Classify needs TypeSafe and OpenAI API keys. Add them in Textfresser's settings.",
		);
	});
});

describe("createKnowledgeQueue", () => {
	it("joins a Reading's running Knowledge and interrupts it on cancel", async () => {
		const notices: string[] = [];
		let started = 0;
		const queue = createKnowledgeQueue({
			notify: (message) => notices.push(message),
			run: () =>
				Effect.sync(() => {
					started++;
				}).pipe(Effect.andThen(Effect.never)),
		});
		const reading = { emojiDescription: "🌊", lemma: see, unitKind: "Reading" } as Dumling.Reading<"de">;
		const job = {
			attestation: attestationOf(see, "See", ["See"], NOUN_EVIDENCE),
			label: "See 🌊",
			lemmaPath: SEE_PATH,
			origin: "New" as const,
			reading,
			readingBlockId: "r-1",
			sentence: { segments: [{ text: "See" }], target: [0] },
		};
		queue.enqueue(job);
		queue.enqueue(job);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(started).toBe(1);
		expect(queue.running()).toBe(1);
		const waiting = queue.awaitNote("Worter/de/Lexeme/NOUN/Masc/See");
		expect(queue.cancelAll()).toBe(1);
		expect(await waiting).toBe("r-1");
		expect(queue.running()).toBe(0);
		expect(notices).toEqual([]);
	});
});

async function seedReading(store: DumdictVaultStore, emojiDescription: string) {
	const revision = await run(store.revision);
	const reading = { emojiDescription, lemma: see, unitKind: "Reading" } as Dumling.Reading<"de">;
	const known = await run(store.lemmaNote(see));
	const result = await run(
		store.commitChanges({
			baseRevision: revision,
			changes: [
				...(known
					? []
					: [
							{
								preconditions: [{ kind: "lemmaMissing" as const, lemma: see }],
								record: { lemma: see },
								type: "createLemma" as const,
							},
						]),
				{
					entry: { attestationLinks: [], attestedTranslations: [], notes: "", reading },
					preconditions: [],
					type: "createReading",
				},
			],
		}),
	);
	if (result.status !== "committed") throw new Error("seed did not commit");
}
