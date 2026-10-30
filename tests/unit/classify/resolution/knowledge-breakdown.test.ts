/**
 * A Reading's Breakdown in its Knowledge run (#266): the Source first, then
 * `segment.inConstituents`, then `segment.inMorphemes` for a bottom word,
 * with the real dictionary store, so each half lands in the Reading note's
 * metadata and reads back through the codec.
 */
import { describe, expect, it } from "bun:test";
import type { Unit } from "dumgen";
import { InvalidModelOutput, ProviderFailure } from "dumgen";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Effect } from "effect";
import { breakdownAskFor } from "../../../../src/commanders/classify/resolution/knowledge-request";
import {
	attestationOf,
	baseTextKnowledge,
	planFor,
	resolutionHarness,
	run,
	shadow,
	stubDumgen,
	unit,
} from "./support";

const SCROLL = "Library/Story.md";
const NOUN_EVIDENCE = { articleEvidence: null, valencyEvidence: [] };
const VERB_EVIDENCE = { expletiveEvidence: null, valencyEvidence: [] };

const noun = (canonicalForm: string, gender: string) =>
	unit({
		canonicalForm,
		coreFeatures: { gender },
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
		unitKind: "Lemma",
	} as Dumling.Lemma<"de">);

const kohlekraftwerk = noun("Kohlekraftwerk", "Neut");
const hund = noun("Hund", "Masc");
const lauf = noun("Lauf", "Masc");
const laufen = unit({
	canonicalForm: "laufen",
	coreFeatures: { hasSepPrefix: null },
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
const mit = unit({
	canonicalForm: "mit",
	coreFeatures: {},
	family: "Lexeme",
	kind: "ADP",
	language: "de",
	unitKind: "Lemma",
} as unknown as Dumling.Lemma<"de">);

const readingOf = (lemma: Dumling.Lemma<"de">, emojiDescription: string) =>
	({ emojiDescription, lemma, unitKind: "Reading" }) as Dumling.Reading<"de">;

const route = (family: string, kind: string) =>
	({ family, kind, language: "de" }) as Unit["route"];

/**
 * A noun at Segment 2 of two Sentences, `Der <word> ist da.` and `Der
 * <word> ist hier.`: the first Classify links the first, a later one the
 * second.
 */
function nounStory(lemma: Dumling.Lemma<"de">) {
	const sentences = [`Der ${lemma.canonicalForm} ist da.`, `Der ${lemma.canonicalForm} ist hier.`];
	const content = `${sentences[0]} ^0\n\n${sentences[1]} ^1\n`;
	return {
		content,
		plan: (scroll: { readonly content: string }, sentence: 0 | 1 = 0) =>
			planFor({
				content: scroll.content,
				scrollPath: SCROLL,
				sentenceText: sentences[sentence] ?? "",
				units: [{ route: route("Lexeme", "NOUN"), segments: [2] }],
			}),
	};
}

const resolvesNoun =
	(lemma: Dumling.Lemma<"de">) => (input: { readonly unit: Unit }) =>
		input.unit.route !== "Unresolved" && input.unit.route.kind === "NOUN"
			? ({
					_tag: "Resolved",
					attestation: attestationOf(
						lemma,
						lemma.canonicalForm,
						[lemma.canonicalForm],
						NOUN_EVIDENCE,
					),
				} as const)
			: ({ _tag: "Unresolved" } as const);

const KOHLE = shadow("Lexeme", "NOUN", "Kohle");
const KRAFTWERK = shadow("Lexeme", "NOUN", "Kraftwerk");
const KOHLEKRAFTWERK_CONSTITUENTS = [
	{ letters: "Kohle", target: KOHLE },
	{ letters: "kraftwerk", target: KRAFTWERK },
];
const HUND_MORPHEMES = [
	{ letters: "Hund", target: shadow("Morpheme", "Root", "hund") },
];

/** The Breakdown and Source the store reads back from the Reading note. */
async function storedOf(
	store: Awaited<ReturnType<typeof resolutionHarness>>["store"],
	lemma: Dumling.Lemma<"de">,
) {
	const note = await run(store.lemmaNote(lemma));
	const knowledge = note?.readings[0]?.knowledge;
	return { breakdown: knowledge?.breakdown, source: knowledge?.source };
}

describe("breakdownAskFor", () => {
	it("asks a Lexeme, Locution or Saying that stores neither a Breakdown nor a Source, with the Source first where its route has one", () => {
		expect(breakdownAskFor({ reading: readingOf(kohlekraftwerk, "🏭") })).toEqual({ source: true });
		expect(breakdownAskFor({ reading: readingOf(aufJedenFall, "✅") })).toEqual({ source: false });
		const stored = (knowledge: Dumrel.ReadingKnowledge<Dumling.Reading<"de">>) =>
			breakdownAskFor({ knowledge, reading: readingOf(kohlekraftwerk, "🏭") });
		expect(stored({ breakdown: { constituents: KOHLEKRAFTWERK_CONSTITUENTS } })).toBeUndefined();
		expect(stored({ breakdown: { morphemes: HUND_MORPHEMES } })).toBeUndefined();
		expect(stored({ source: { target: KOHLE } })).toBeUndefined();
		// The base text alone is no Breakdown: a failed one is asked again.
		expect(stored({ definition: "defined" } as never)).toEqual({ source: true });
	});

	it("asks nothing of a Closed Route member or a Morpheme", () => {
		expect(breakdownAskFor({ reading: readingOf(mit, "🤝") })).toBeUndefined();
		const ung = unit({
			canonicalForm: "-ung",
			coreFeatures: {},
			family: "Morpheme",
			kind: "Suffix",
			language: "de",
			unitKind: "Lemma",
		} as unknown as Dumling.Lemma<"de">);
		expect(breakdownAskFor({ reading: readingOf(ung, "🔚") })).toBeUndefined();
	});
});

describe("a Reading's Breakdown in its Knowledge run", () => {
	it("breaks a compound into its Constituents after asking for its Source, and stores them through the codec", async () => {
		const story = nounStory(kohlekraftwerk);
		const order: string[] = [];
		const stub = stubDumgen({
			grammar: resolvesNoun(kohlekraftwerk),
			inConstituents: (input) =>
				Effect.sync(() => {
					order.push("inConstituents");
					expect(input.reading.lemma).toEqual(kohlekraftwerk);
					expect(input.sentence).toBe("Der Kohlekraftwerk ist da.");
					return { kind: "Constituents", pieces: KOHLEKRAFTWERK_CONSTITUENTS } as const;
				}),
			knowledge: (input) => {
				order.push("knowledge.produce");
				return baseTextKnowledge(input);
			},
			reading: () => ({ _tag: "New", emojiDescription: "🏭" }),
		});
		const harness = await resolutionHarness({ content: story.content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(story.plan(harness.scroll));

		expect(order).toEqual(["knowledge.produce", "inConstituents"]);
		expect(stub.calls.knowledge[0]?.request.source).toBeNull();
		expect(stub.calls.inMorphemes).toHaveLength(0);
		expect(await storedOf(harness.store, kohlekraftwerk)).toEqual({
			breakdown: { constituents: KOHLEKRAFTWERK_CONSTITUENTS },
			source: undefined,
		});
		expect(harness.notices).toEqual(["✓ Knowledge for Kohlekraftwerk 🏭 saved"]);

		// A later occurrence of a Reading broken down asks nothing (a top-up).
		await harness.resolve(story.plan(harness.scroll, 1));
		expect(stub.calls.knowledge).toHaveLength(1);
		expect(stub.calls.inConstituents).toHaveLength(1);
	});

	it("splits a bottom word, which has no Constituents, into its morphemes", async () => {
		const story = nounStory(hund);
		const stub = stubDumgen({
			grammar: resolvesNoun(hund),
			inMorphemes: () => Effect.succeed(HUND_MORPHEMES),
			knowledge: baseTextKnowledge,
			reading: () => ({ _tag: "New", emojiDescription: "🐕" }),
		});
		const harness = await resolutionHarness({ content: story.content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(story.plan(harness.scroll));

		expect(stub.calls.inConstituents).toHaveLength(1);
		expect(stub.calls.inMorphemes).toHaveLength(1);
		expect((await storedOf(harness.store, hund)).breakdown).toEqual({ morphemes: HUND_MORPHEMES });
	});

	it("stores a conversion's Source and runs no segmenter", async () => {
		const story = nounStory(lauf);
		const source = { target: shadow("Lexeme", "VERB", "laufen") };
		const stub = stubDumgen({
			grammar: resolvesNoun(lauf),
			knowledge: (input) => ({
				changes: [
					...baseTextKnowledge(input).changes,
					{ aspect: "source", kind: "Contribute", value: source },
				],
			}),
			reading: () => ({ _tag: "New", emojiDescription: "🏃" }),
		});
		const harness = await resolutionHarness({ content: story.content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(story.plan(harness.scroll));

		expect(stub.calls.inConstituents).toHaveLength(0);
		expect(stub.calls.inMorphemes).toHaveLength(0);
		expect(await storedOf(harness.store, lauf)).toEqual({ breakdown: undefined, source });
		expect(harness.notices).toEqual(["✓ Knowledge for Lauf 🏃 saved"]);
	});

	it("holds both segmenters on an Unresolved Source, and asks for the Source again on the next Classify", async () => {
		const story = nounStory(lauf);
		let unresolved = true;
		const stub = stubDumgen({
			grammar: resolvesNoun(lauf),
			knowledge: (input) =>
				unresolved
					? {
							...baseTextKnowledge(input),
							failures: [{ aspect: "source", code: "Unresolved", message: "undecided" }],
						}
					: baseTextKnowledge(input),
			reading: (input) =>
				input.candidates.length > 0
					? { _tag: "Reuse", emojiDescription: "🏃" }
					: { _tag: "New", emojiDescription: "🏃" },
		});
		const harness = await resolutionHarness({ content: story.content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(story.plan(harness.scroll));

		expect(stub.calls.inConstituents).toHaveLength(0);
		expect(stub.calls.inMorphemes).toHaveLength(0);
		expect(await storedOf(harness.store, lauf)).toEqual({ breakdown: undefined, source: undefined });
		expect(harness.notices).toEqual([
			"⚠ Knowledge for Lauf 🏃 saved without source; Classify it again to retry",
		]);

		// The next Classify asks for the Source alone, then breaks it down.
		unresolved = false;
		await harness.resolve(story.plan(harness.scroll, 1));
		expect(stub.calls.knowledge[1]?.origin).toBe("TopUp");
		expect(stub.calls.knowledge[1]?.request).toEqual({ source: null });
		expect(stub.calls.inConstituents).toHaveLength(1);
		expect((await storedOf(harness.store, lauf)).breakdown?.morphemes).toBeDefined();
	});

	it("keeps the rest of the Knowledge when a segmenter fails, and the next Classify retries it", async () => {
		const story = nounStory(kohlekraftwerk);
		let failing = true;
		const stub = stubDumgen({
			grammar: resolvesNoun(kohlekraftwerk),
			inConstituents: () =>
				failing
					? Effect.fail(new ProviderFailure({ message: "no answer", stage: "breakdown-analysis" }))
					: Effect.succeed({ kind: "Constituents", pieces: KOHLEKRAFTWERK_CONSTITUENTS } as const),
			knowledge: baseTextKnowledge,
			reading: (input) =>
				input.candidates.length > 0
					? { _tag: "Reuse", emojiDescription: "🏭" }
					: { _tag: "New", emojiDescription: "🏭" },
		});
		const harness = await resolutionHarness({ content: story.content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(story.plan(harness.scroll));

		const note = await run(harness.store.lemmaNote(kohlekraftwerk));
		expect(note?.readings[0]?.knowledge?.definition).toBe("Kohlekraftwerk, defined");
		expect(note?.readings[0]?.knowledge?.breakdown).toBeUndefined();
		// No bottom word: a failed segmenter runs no other.
		expect(stub.calls.inMorphemes).toHaveLength(0);
		expect(harness.notices).toEqual([
			"⚠ Knowledge for Kohlekraftwerk 🏭 saved without breakdown/constituents; Classify it again to retry",
		]);

		failing = false;
		await harness.resolve(story.plan(harness.scroll, 1));
		expect(stub.calls.inConstituents).toHaveLength(2);
		expect((await storedOf(harness.store, kohlekraftwerk)).breakdown).toEqual({
			constituents: KOHLEKRAFTWERK_CONSTITUENTS,
		});
		expect(harness.notices.at(-1)).toBe("✓ Knowledge for Kohlekraftwerk 🏭 saved");
	});

	it("rejects a split whose letters don't spell the word, and keeps the rest", async () => {
		const story = nounStory(hund);
		const stub = stubDumgen({
			grammar: resolvesNoun(hund),
			inMorphemes: () =>
				Effect.succeed([{ letters: "Hun", target: shadow("Morpheme", "Root", "hun") }]),
			knowledge: baseTextKnowledge,
			reading: () => ({ _tag: "New", emojiDescription: "🐕" }),
		});
		const harness = await resolutionHarness({ content: story.content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(story.plan(harness.scroll));

		const note = await run(harness.store.lemmaNote(hund));
		expect(note?.readings[0]?.knowledge?.breakdown).toBeUndefined();
		expect(note?.readings[0]?.knowledge?.definition).toBe("Hund, defined");
		expect(harness.notices).toEqual([
			"⚠ Knowledge for Hund 🐕 saved without breakdown/morphemes; Classify it again to retry",
		]);
	});

	it("reports a failed morphemes split as its part", async () => {
		const story = nounStory(hund);
		const stub = stubDumgen({
			grammar: resolvesNoun(hund),
			inMorphemes: () => Effect.fail(new InvalidModelOutput({ message: "unusable", stage: "morphemes" })),
			knowledge: baseTextKnowledge,
			reading: () => ({ _tag: "New", emojiDescription: "🐕" }),
		});
		const harness = await resolutionHarness({ content: story.content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(story.plan(harness.scroll));
		expect(harness.notices).toEqual([
			"⚠ Knowledge for Hund 🐕 saved without breakdown/morphemes; Classify it again to retry",
		]);
	});

	it("drops a Source that points back at a word whose stored Source names this one, and breaks the word down", async () => {
		const sentences = { NOUN: "Der Lauf ist kurz.", VERB: "Wir laufen." } as const;
		const content = `${sentences.VERB} ^0\n\n${sentences.NOUN} ^1\n`;
		const plan = (kind: "NOUN" | "VERB") =>
			planFor({
				content: harness.scroll.content,
				scrollPath: SCROLL,
				sentenceText: sentences[kind],
				units: [{ route: route("Lexeme", kind), segments: [2] }],
			});
		const stub = stubDumgen({
			grammar: (input) => {
				if (input.unit.route === "Unresolved") return { _tag: "Unresolved" };
				return input.unit.route.kind === "VERB"
					? { _tag: "Resolved", attestation: attestationOf(laufen, "laufen", ["laufen"], VERB_EVIDENCE) }
					: { _tag: "Resolved", attestation: attestationOf(lauf, "Lauf", ["Lauf"], NOUN_EVIDENCE) };
			},
			// Each names the other: laufen's, stored first, wins.
			knowledge: (input) => ({
				changes: [
					...baseTextKnowledge(input).changes,
					{
						aspect: "source",
						kind: "Contribute",
						value: {
							target:
								input.reading.lemma.kind === "VERB"
									? shadow("Lexeme", "NOUN", "Lauf")
									: shadow("Lexeme", "VERB", "laufen"),
						},
					},
				],
			}),
			reading: (input) => ({
				_tag: "New",
				emojiDescription: input.attestation.surface.lemma.kind === "VERB" ? "🏃" : "🏁",
			}),
		});
		const harness = await resolutionHarness({ content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(plan("VERB"));
		expect((await storedOf(harness.store, laufen)).source).toEqual({ target: shadow("Lexeme", "NOUN", "Lauf") });

		await harness.resolve(plan("NOUN"));
		expect(stub.calls.inConstituents.map(({ reading }) => reading.lemma.canonicalForm)).toEqual(["Lauf"]);
		const stored = await storedOf(harness.store, lauf);
		expect(stored.source).toBeUndefined();
		expect(stored.breakdown?.morphemes).toEqual([
			{ letters: "Lauf", target: shadow("Morpheme", "Root", "lauf") },
		]);
	});

	it("gives a Locution with no Constituents no morphemes", async () => {
		const sentenceText = "Er kommt auf jeden Fall.";
		const content = `${sentenceText} ^0\n`;
		const stub = stubDumgen({
			grammar: (input) =>
				input.unit.route !== "Unresolved" && input.unit.route.family === "Locution"
					? {
							_tag: "Resolved",
							attestation: attestationOf(aufJedenFall, "auf jeden Fall", ["auf", "jeden", "Fall"]),
						}
					: { _tag: "Unresolved" },
			knowledge: baseTextKnowledge,
			reading: () => ({ _tag: "New", emojiDescription: "✅" }),
		});
		const harness = await resolutionHarness({ content, dumgen: stub.dumgen, scrollPath: SCROLL });
		await harness.resolve(
			planFor({
				content,
				scrollPath: SCROLL,
				sentenceText,
				units: [{ route: route("Locution", "ADV"), segments: [4, 6, 8] }],
			}),
		);
		expect(stub.calls.knowledge[0]?.request.source).toBeUndefined();
		expect(stub.calls.inConstituents).toHaveLength(1);
		expect(stub.calls.inMorphemes).toHaveLength(0);
		expect(harness.notices).toEqual(["✓ Knowledge for auf jeden Fall ✅ saved"]);
	});
});
