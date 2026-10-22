import { describe, expect, it } from "bun:test";
import type { DumdictVaultStore } from "@textfresser/dictionary";
import { Transaction } from "@textfresser/dictionary";
import { lemmaNotePath, readingNotePath } from "@textfresser/lemma-note-codec";
import type { Unit } from "dumgen";
import { createDumgen } from "dumgen";
import type * as Dumling from "dumling/types";
import { variantIdOf } from "dumrel";
import { Effect, Layer, Result } from "effect";
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
import { FakeVault } from "../../../../src/packages/composed/dictionary/tests/support/fake-vault";
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

const SEE_PATH = lemmaNotePath(see).path;
const SEE_READING_PATH = readingNotePath({
	emojiDescription: "🌊",
	lemma: see,
	unitKind: "Reading",
} as Dumling.Reading<"de">).path;
/** A Reading note's link, as Classify writes it: path-qualified, no Block. */
const readingLink = (path: string, shown: string) =>
	`[[${path.replace(/\.md$/u, "")}|${shown}]]`;

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
		// The occurrence's Attestation Link: one ref per occurrence, an embed
		// of its block whose alias keys the occurrence.
		expect(entry?.attestationLinks).toHaveLength(1);
		const [link] = entry?.attestationLinks ?? [];
		expect(link?.ref).toMatch(/^!\[\[Story#\^0\|\^[0-9a-f]{8}\]\]$/u);
		expect(link?.surfaceId).toBe(note?.ownedSurfaces[0]?.id);
		// The Reading note shows it under Deine Kontexte.
		expect(harness.vault.content(SEE_READING_PATH)).toContain(link?.ref ?? "?");
		expect(entry?.knowledge?.definition).toBe("See, defined");
		expect(note?.ownedSurfaces.map(({ surface }) => surface.normalizedSurface)).toEqual(["See"]);

		const [resolution] = resolutions;
		if (resolution?._tag !== "Resolved") throw new Error("See did not resolve");
		expect(resolution.readingPath).toBe(SEE_READING_PATH);
		expect(resolution.linked).toBe(1);
		expect(harness.scroll.content).toBe(
			`Der ${readingLink(SEE_READING_PATH, "See")} ist tief. ^0\n`,
		);
		expect(calls.reading[0]?.candidates).toEqual([]);
		expect(calls.knowledge).toHaveLength(1);
		expect(calls.knowledge[0]?.origin).toBe("New");
		expect(harness.notices).toEqual(["✓ Knowledge for See 🌊 saved"]);
	});

	it("asks for the Lemma Paradigm unless disabled, and stores the Paradigm Changes it gets", async () => {
		const content = "Der See ist tief. ^0\n\nDer See ist blau. ^1\n";
		const lake = { emojiDescription: "🌊", lemma: see, unitKind: "Reading" } as Dumling.Reading<"de">;
		const plan = planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits });
		const off = stubDumgen({
			grammar: seeGrammar,
			knowledge: baseTextKnowledge,
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		await (await resolutionHarness({ content, dumgen: off.dumgen, produceParadigm: false, scrollPath: SCROLL })).resolve(plan);
		expect(off.calls.knowledge[0]?.paradigm).toBeUndefined();

		const seen = variantIdOf(see, "plural", "Seen");
		const on = stubDumgen({
			grammar: seeGrammar,
			knowledge: (input) => ({
				...baseTextKnowledge(input),
				paradigmChanges:
					input.paradigm?.stored === undefined
						? [
								{ dimension: "plural", kind: "Contribute", provenance: "Produced", value: "Seen" },
								{ dimension: "plural", kind: "License", reading: input.reading, variants: [seen] },
							]
						: [{ dimension: "plural", kind: "License", reading: input.reading, variants: [seen] }],
			}),
			reading: (input) =>
				input.candidates.length === 0
					? { _tag: "New", emojiDescription: "🌊" }
					: { _tag: "New", emojiDescription: "🏞" },
		});
		const harness = await resolutionHarness({ content, dumgen: on.dumgen, scrollPath: SCROLL });
		await harness.resolve(plan);
		expect(on.calls.knowledge[0]?.paradigm).toEqual({ dimensions: ["plural"], readings: [lake] });
		const stored = (await run(harness.store.lemmaNote(see)))?.paradigm;
		expect(stored?.dimensions.plural?.variants.map(({ value }) => value)).toEqual(["Seen"]);

		// A later Reading of the Lemma is judged against the stored Paradigm.
		await harness.resolve(
			planFor({
				content: harness.scroll.content,
				scrollPath: SCROLL,
				sentenceText: "Der See ist blau.",
				units: seeUnits,
			}),
		);
		expect(on.calls.knowledge[1]?.paradigm).toMatchObject({ dimensions: ["plural"], stored });
		const both = (await run(harness.store.lemmaNote(see)))?.paradigm;
		expect(Object.keys(both?.dimensions.plural?.licences ?? {})).toHaveLength(2);
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
		// Each occurrence holds its own link, from its own block.
		expect(note?.readings[0]?.attestationLinks.map(({ ref }) => ref.slice(0, 13))).toEqual([
			"![[Story#^0|^",
			"![[Story#^1|^",
		]);
		// The stored entry covers what a later occurrence may ask: no model call.
		expect(stub.calls.knowledge).toHaveLength(1);
		expect(harness.scroll.content.split(readingLink(SEE_READING_PATH, "See"))).toHaveLength(3);

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

	describe("after its Scroll moved onto a name another note has (#198)", () => {
		const TALE = "Library/Tale.md";
		const reuse = () =>
			stubDumgen({
				grammar: seeGrammar,
				knowledge: baseTextKnowledge,
				reading: (input) =>
					input.candidates.includes("🌊")
						? { _tag: "Reuse", emojiDescription: "🌊" }
						: { _tag: "New", emojiDescription: "🌊" },
			});
		const refsOf = async (store: DumdictVaultStore) =>
			((await run(store.lemmaNote(see)))?.readings[0]?.attestationLinks ?? []).map(({ ref }) => ref);

		/** Classifies "Der See ist tief." in Story, then renames Story to Tale beside Archive/Tale.md. */
		async function classifiedThenMoved() {
			const content = "Der See ist tief. ^0\n";
			const vault = new FakeVault({ "Archive/Tale.md": "another Tale" });
			const first = await resolutionHarness({ content, dumgen: reuse().dumgen, scrollPath: SCROLL, vault });
			await first.resolve(planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }));
			const [written = ""] = await refsOf(first.store);
			expect(written).toMatch(/^!\[\[Story#\^0\|\^[0-9a-f]{8}\]\]$/u);
			vault.silentWrite(SCROLL, first.scroll.content);
			await vault.userRename(SCROLL, TALE);
			// The store named the moved Scroll by its path: Obsidian opens Archive/Tale.md for "Tale".
			expect(await refsOf(first.store)).toEqual([written.replace("![[Story#", "![[Library/Tale#")]);
			await run(first.store.close);
			// The same occurrence, Classified again in the moved Scroll.
			return { content, vault };
		}

		it("writes a new ref by the Scroll's path, so the occurrence keeps one ref", async () => {
			const { content, vault } = await classifiedThenMoved();
			const again = await resolutionHarness({ content, dumgen: reuse().dumgen, scrollPath: TALE, vault });
			expect(await run(again.store.scrollRefNames(TALE))).toEqual({
				aliases: ["Library/Tale"],
				linkpath: "Library/Tale",
			});
			const before = vault.batches.length;
			const resolved = await again.resolve(
				planFor({ content, scrollPath: TALE, sentenceText: "Der See ist tief.", units: seeUnits }),
			);
			expect(resolved[0]?._tag).toBe("Resolved");
			const refs = await refsOf(again.store);
			expect(refs).toHaveLength(1);
			expect(refs[0]).toMatch(/^!\[\[Library\/Tale#\^0\|\^[0-9a-f]{8}\]\]$/u);
			expect(vault.batches.length).toBe(before);
		});

		it("matches the stored ref by path once the basename is the Scroll's again", async () => {
			const { content, vault } = await classifiedThenMoved();
			await vault.userDelete("Archive/Tale.md");
			const again = await resolutionHarness({ content, dumgen: reuse().dumgen, scrollPath: TALE, vault });
			// New refs name the Scroll by its basename again; the stored one by its path still opens it.
			expect(await run(again.store.scrollRefNames(TALE))).toEqual({
				aliases: ["Tale", "Library/Tale"],
				linkpath: "Tale",
			});
			const [stored = ""] = await refsOf(again.store);
			expect(stored).toMatch(/^!\[\[Library\/Tale#\^0\|/u);
			await again.resolve(planFor({ content, scrollPath: TALE, sentenceText: "Der See ist tief.", units: seeUnits }));
			expect(await refsOf(again.store)).toEqual([stored]);
		});
	});

	it("moves an occurrence judged another Reading: the old one goes with its last link", async () => {
		const content = "Der See ist tief. ^0\n";
		const plan = planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits });
		let emoji = "🌊";
		const stub = stubDumgen({
			grammar: seeGrammar,
			knowledge: baseTextKnowledge,
			reading: () => ({ _tag: "New", emojiDescription: emoji }),
		});
		const harness = await resolutionHarness({ content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(plan);
		const [first] = (await run(harness.store.lemmaNote(see)))?.readings ?? [];
		const ref = first?.attestationLinks[0]?.ref;
		expect(ref).toBeDefined();

		emoji = "🏞";
		const [moved] = await harness.resolve({ ...plan, content: harness.scroll.content });
		expect(moved?._tag).toBe("Resolved");
		const note = await run(harness.store.lemmaNote(see));
		expect(note?.readings.map(({ reading }) => ("emojiDescription" in reading ? reading.emojiDescription : ""))).toEqual(["🏞"]);
		expect(note?.readings[0]?.attestationLinks.map((link) => link.ref)).toEqual([ref ?? ""]);
		// 🌊 lost its last occurrence, so its Reading note went with it.
		expect(harness.vault.content(SEE_READING_PATH)).toBeUndefined();
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
		expect(resolution.readingPath).toMatch(
			/^Worter\/de\/Lexeme\/VERB\/an\/a\/anf\/anfan\/\S+ anfangen\.md$/u,
		);
		expect(resolution.linked).toBe(2);
		const link = (shown: string) => readingLink(resolution.readingPath, shown);
		// The block had no ID: the Attestation Ref minted one.
		expect(harness.scroll.content).toBe(`Er ${link("fängt")} heute ${link("an")}. ^0\n`);
		const note = await run(harness.store.lemmaNote(anfangen));
		// One occurrence of two pieces: one Attestation Link.
		expect(note?.readings[0]?.attestationLinks).toHaveLength(1);
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
				transact: (plan, options) =>
					store.transact(
						(view) =>
							Result.map(plan(view), (step) => {
								if (step._tag === "Commit" || step._tag === "CommitAndReplan")
									planned.push(step.plan.changes.length);
								return step;
							}),
						options,
					),
			}),
		});
		await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		const note = await run(harness.store.lemmaNote(see));
		expect(note?.pendingRelations).toHaveLength(60);
		expect(Math.max(...planned)).toBeLessThanOrEqual(50);
		// The pending relations live in the source's Reading note alone.
		expect(
			harness.vault
				.markdownPaths()
				.filter((path) => path.startsWith("Worter/") && path.includes("teich")),
		).toEqual([]);
		expect(harness.vault.content(SEE_READING_PATH)).toContain("[[Worter/t/tei/teich/teich7|Teich7]]");
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
		expect(resolution.readingPath.startsWith("Worter/de/Locution/ADV/a/auf/aufje/")).toBe(true);
		expect(harness.scroll.content).toBe(
			`Er kommt ${readingLink(resolution.readingPath, "auf jeden Fall")}. ^3\n`,
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

	/**
	 * A store whose first transaction's plans each meet a hand edit of
	 * See's Lemma note that no event has delivered yet, `edits` times.
	 */
	async function editedDuringPlans(edits: number) {
		const content = "Der See ist tief. ^0\n";
		const vault = new FakeVault();
		let plans = 0;
		let wrapped = false;
		const { dumgen } = stubDumgen({
			grammar: seeGrammar,
			reading: () => ({ _tag: "New", emojiDescription: "🌊" }),
		});
		const harness = await resolutionHarness({
			content,
			dumgen,
			scrollPath: SCROLL,
			vault,
			wrapStore: (store) => ({
				...store,
				transact: (plan, options) => {
					if (wrapped) return store.transact(plan, options);
					wrapped = true;
					return store.transact((view) => {
						plans++;
						if (plans <= edits) {
							// Typed under the header, above the note's metadata.
							const [header, ...rest] = (vault.content(SEE_PATH) ?? "").split("\n");
							vault.silentWrite(SEE_PATH, [header, `Notiz ${plans}`, ...rest].join("\n"));
						}
						return plan(view);
					}, options);
				},
			}),
		});
		await seedReading(harness.store, "⛵");
		const [resolution] = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		return { harness, plans: () => plans, resolution, vault };
	}

	it("plans again when the commit meets an edit made outside the store", async () => {
		const { harness, plans, resolution, vault } = await editedDuringPlans(1);
		expect(plans()).toBe(2);
		expect(resolution?._tag).toBe("Resolved");
		expect((await run(harness.store.lemmaNote(see)))?.readings).toHaveLength(2);
		// The edit the first plan missed is kept, not written over.
		expect(vault.content(SEE_PATH)).toContain("Notiz 1");
	});

	it("gives up after its attempts when every commit meets an outside edit", async () => {
		const { harness, plans, resolution, vault } = await editedDuringPlans(Number.POSITIVE_INFINITY);
		expect(plans()).toBe(4);
		expect(resolution).toMatchObject({ _tag: "Pending" });
		expect(resolution?._tag === "Pending" ? resolution.reason : "").toContain(
			"The dictionary kept changing while this occurrence committed",
		);
		expect((await run(harness.store.lemmaNote(see)))?.readings).toHaveLength(1);
		expect(vault.content(SEE_PATH)).toContain("Notiz 4");
	});

	it("judges a stale New again outside the store's lock", async () => {
		const content = "Der See ist tief. ^0\n";
		let store: DumdictVaultStore | undefined;
		const lockFree: boolean[] = [];
		const stub = stubDumgen({
			grammar: seeGrammar,
			reading: async (input) => {
				if (store) {
					// A judge running under the lock would wait here for ever.
					const probe = store.transact(() => Result.succeed(Transaction.stop(true)));
					lockFree.push(
						await run(
							probe.pipe(
								Effect.timeoutOrElse({
									duration: "1 second",
									orElse: () => Effect.succeed(false),
								}),
							),
						),
					);
				}
				if (input.written !== undefined)
					return { _tag: "New", emojiDescription: input.written };
				if (store) await seedReading(store, "⛵");
				return { _tag: "New", emojiDescription: "🌊" };
			},
		});
		const harness = await resolutionHarness({ content, dumgen: stub.dumgen, scrollPath: SCROLL });
		store = harness.store;
		const [resolution] = await harness.resolve(
			planFor({ content, scrollPath: SCROLL, sentenceText: "Der See ist tief.", units: seeUnits }),
		);
		expect(resolution?._tag).toBe("Resolved");
		expect(stub.calls.reading).toHaveLength(2);
		expect(lockFree).toEqual([true, true]);
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
			`Titel\n\nDer ${readingLink(SEE_READING_PATH, "See")} ist tief. ^0\nNeu getippt.\n`,
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
			origin: "New" as const,
			reading,
			readingPath: SEE_READING_PATH,
			sentence: { segments: [{ text: "See" }], target: [0] },
		};
		queue.enqueue(job);
		queue.enqueue(job);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(started).toBe(1);
		expect(queue.running()).toBe(1);
		const waiting = queue.awaitNote(SEE_READING_PATH.slice(0, -3));
		expect(queue.cancelAll()).toBe(1);
		expect(await waiting).toBe(true);
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
