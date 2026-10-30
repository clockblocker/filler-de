import { describe, expect, it } from "bun:test";
import { germanMorphemePolicy } from "dumcorpus/inventories";
import type { ReadingEntry } from "dumdict";
import { lemmaIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Result } from "effect";
import {
	type LemmaRecords,
	MORPHEMES_LINE_CLASS,
	type RenderOptions,
	renderReadingNote,
	serializeReadingNote,
} from "../src";
import {
	freeformTexts,
	parseReading,
	readingNoteDataOf,
	valid,
} from "./helpers";

type De = "de";

const lemma = (
	canonicalForm: string,
	kind: string,
	coreFeatures: Record<string, unknown> = {},
	family = "Lexeme",
): Dumling.Lemma<De> =>
	({
		canonicalForm,
		coreFeatures,
		family,
		kind,
		language: "de",
		unitKind: "Lemma",
	}) as Dumling.Lemma<De>;

const noun = (canonicalForm: string, gender: "Fem" | "Masc" | "Neut") =>
	lemma(canonicalForm, "NOUN", { gender });

const shadow = (
	canonicalForm: string,
	kind: string,
	family = "Lexeme",
): Dumrel.LinkTarget =>
	({ canonicalForm, family, kind, language: "de" }) as Dumrel.LinkTarget;

const piece = (
	letters: string,
	target?: Dumling.Lemma<De> | Dumrel.LinkTarget,
) => (target === undefined ? { letters } : { letters, target });

const readingOf = (of: Dumling.Lemma<De>, emoji: string) =>
	({
		emojiDescription: emoji,
		lemma: of,
		unitKind: "Reading",
	}) as Dumling.Reading<De>;

/** One Lemma with one Reading that stores `knowledge`. */
function recordsOf(
	of: Dumling.Lemma<De>,
	emoji: string,
	knowledge: ReadingEntry<De>["knowledge"],
): { records: LemmaRecords<De>; reading: Dumling.Reading<De> } {
	const reading = readingOf(of, emoji);
	return {
		reading,
		records: {
			lemmaRecord: { lemma: of },
			ownedSurfaceEntries: [],
			pendingRelations: [],
			readingEntries: [
				{
					attestationLinks: [],
					attestedTranslations: [],
					knowledge,
					notes: "",
					reading,
				},
			],
		},
	};
}

/** A lookup over stored Lemmas' Breakdowns and Sources, by Lemma identity. */
function lookupOf(
	stored: readonly (readonly [Dumling.Lemma<De>, Dumrel.MorphemeSources])[],
): Dumrel.LookupMorphemeSources {
	const byKey = new Map(
		stored.map(([of, sources]) => [lemmaIdentityKey(of), sources]),
	);
	return (target) => {
		if (!("unitKind" in target)) return [];
		const sources = byKey.get(lemmaIdentityKey(target as Dumling.Lemma));
		return sources === undefined ? [] : [sources];
	};
}

const options = (
	stored: readonly (readonly [
		Dumling.Lemma<De>,
		Dumrel.MorphemeSources,
	])[] = [],
): RenderOptions<De> => ({
	morphemePolicy: germanMorphemePolicy,
	morphemeSources: lookupOf(stored),
});

/** The Morpheme section's lines of a rendered note: its title to the next title. */
function morphemeSection(body: string): string[] {
	const lines = body.split("\n");
	const start = lines.findIndex((line) =>
		line.includes("note_block_title_morpheme"),
	);
	if (start < 0) return [];
	const end = lines.findIndex(
		(line, index) => index > start && line.includes("note_block_title"),
	);
	const section = lines.slice(start, end < 0 ? undefined : end);
	while (section.at(-1) === "") section.pop();
	return section;
}

const render = (
	{
		records,
		reading,
	}: { records: LemmaRecords<De>; reading: Dumling.Reading<De> },
	with_: RenderOptions<De> = options(),
) => Result.getOrThrow(renderReadingNote(records, reading, with_));

const TITLE =
	'<span class="note_block_title note_block_title_morpheme">Morpheme</span>';
const MARKER = `<span class="${MORPHEMES_LINE_CLASS}"></span>`;

const kohle = noun("Kohle", "Fem");
const kraft = noun("Kraft", "Fem");
const kraftwerk = noun("Kraftwerk", "Neut");
const kohlekraftwerk = noun("Kohlekraftwerk", "Neut");

const KOHLE = "[[Worter/de/Lexeme/NOUN/Fem/k/koh/kohle/Kohle|Kohle]]";
const KRAFTWERK_LEMMA = "Worter/de/Lexeme/NOUN/Neut/k/kra/kraft/Kraftwerk";

/** Kohlekraftwerk's Constituents: `Kohle` stored, `Kraftwerk` as given. */
const kohlekraftwerkOf = (kraftwerkTarget: Dumrel.LinkTarget) =>
	recordsOf(kohlekraftwerk, "🏭", {
		breakdown: {
			constituents: [
				piece("Kohle", kohle),
				piece("kraftwerk", kraftwerkTarget),
			],
		},
		translations: {
			en: [[{ kind: "Text", text: "coal-fired power plant" }]],
		},
	});

describe("the Morpheme section of a Reading note", () => {
	it("renders the exemplar's two lines for Kohlekraftwerk, walking the stored Kraftwerk", () => {
		const body = render(
			kohlekraftwerkOf(kraftwerk),
			options([
				[
					kraftwerk,
					{
						breakdown: {
							// `Kraft` is stored, `Werk` is still a pending Shadow.
							constituents: [
								piece("Kraft", kraft),
								piece("werk", shadow("Werk", "NOUN")),
							],
						},
					},
				],
			]),
		);
		expect(morphemeSection(body)).toEqual([
			TITLE,
			`${MARKER}${KOHLE}|[[Worter/de/Lexeme/NOUN/Fem/k/kra/kraft/Kraft|kraft]]|[[Worter/w/wer/werk/werk|werk]]`,
			`${KOHLE} + [[${KRAFTWERK_LEMMA}|Kraftwerk]]`,
		]);
		// In Semantische Beziehungen' place: after Note, before Übersetzung.
		expect(body.indexOf(TITLE)).toBeGreaterThan(
			body.indexOf("Note</span>"),
		);
		expect(body.indexOf(TITLE)).toBeLessThan(body.indexOf("Übersetzung"));
	});

	it("shows a pending part as one unsplit chunk linking its Crossroad note", () => {
		const body = render(
			kohlekraftwerkOf(shadow("Kraftwerk", "NOUN")),
			options(),
		);
		expect(morphemeSection(body)).toEqual([
			TITLE,
			`${MARKER}${KOHLE}|[[Worter/k/kra/kraft/kraftwerk|kraftwerk]]`,
			`${KOHLE} + [[Worter/k/kra/kraft/kraftwerk|Kraftwerk]]`,
		]);
	});

	it("shows a bottom word's stored morphemes only, without its zero ending", () => {
		const body = render(
			recordsOf(kraft, "💪", {
				breakdown: {
					morphemes: [
						piece("kraft", shadow("kraft", "Root", "Morpheme")),
						piece("", shadow("-∅", "Ending", "Morpheme")),
					],
				},
			}),
		);
		expect(morphemeSection(body)).toEqual([
			TITLE,
			`${MARKER}[[Worter/k/kra/kraft/kraft|kraft]]`,
		]);
	});

	it("shows a conversion's Source, and the morphemes walked through it", () => {
		const laufen = lemma("laufen", "VERB");
		const body = render(
			recordsOf(noun("Lauf", "Masc"), "🏃", {
				source: { target: laufen },
			}),
			options([
				[
					laufen,
					{
						breakdown: {
							morphemes: [
								piece(
									"lauf",
									shadow("lauf", "Root", "Morpheme"),
								),
								piece(
									"en",
									shadow("-en", "Ending", "Morpheme"),
								),
							],
						},
					},
				],
			]),
		);
		expect(morphemeSection(body)).toEqual([
			TITLE,
			`${MARKER}[[Worter/l/lau/lauf/lauf|Lauf]]`,
			"← [[Worter/de/Lexeme/VERB/l/lau/laufe/laufen|laufen]]",
		]);
	});

	it("names a participle's Drifted meaning, and shows a Verbal one as a plain Source", () => {
		const lassen = lemma("lassen", "VERB");
		const drifted = render(
			recordsOf(lemma("gelassen", "ADJ"), "😌", {
				source: { meaning: "Drifted", target: lassen },
			}),
		);
		expect(morphemeSection(drifted).at(-1)).toBe(
			"← *historically the participle of* [[Worter/de/Lexeme/VERB/l/las/lasse/lassen|lassen]]",
		);
		const verbal = render(
			recordsOf(lemma("gekocht", "ADJ"), "🍳", {
				source: { meaning: "Verbal", target: shadow("kochen", "VERB") },
			}),
		);
		expect(morphemeSection(verbal).at(-1)).toBe(
			"← [[Worter/k/koc/koche/kochen|kochen]]",
		);
	});

	it("shows a Locution's constituents by its wording, and no morphemes line", () => {
		const body = render(
			recordsOf(
				lemma("den Faden verlieren", "VERB", {}, "Locution"),
				"🧵",
				{
					breakdown: {
						constituents: [
							piece("den Faden", noun("Faden", "Masc")),
							piece(" "),
							piece("verlieren", shadow("verlieren", "VERB")),
						],
					},
				},
			),
		);
		expect(morphemeSection(body)).toEqual([
			TITLE,
			"[[Worter/de/Lexeme/NOUN/Masc/f/fad/faden/Faden|den Faden]] + [[Worter/v/ver/verli/verlieren|verlieren]]",
		]);
	});

	it("shows the letters of a piece without a target unlinked", () => {
		const lkw = noun("Lkw", "Masc");
		const fahrer = noun("Fahrer", "Masc");
		const hyphenated = render(
			recordsOf(noun("Lkw-Fahrer", "Masc"), "🚚", {
				breakdown: {
					constituents: [
						piece("Lkw", lkw),
						piece("-"),
						piece("fahrer", fahrer),
					],
				},
			}),
		);
		// The hyphen is filler: shown among the morphemes, left out of the parts.
		expect(morphemeSection(hyphenated).slice(1)).toEqual([
			`${MARKER}[[Worter/de/Lexeme/NOUN/Masc/l/lkw/lkw/Lkw|Lkw]]|-|[[Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer|fahrer]]`,
			"[[Worter/de/Lexeme/NOUN/Masc/l/lkw/lkw/Lkw|Lkw]] + [[Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer|Fahrer]]",
		]);

		// A Source's letters the walk could not place around its Root.
		const singen = lemma("singen", "VERB");
		const sung = render(
			recordsOf(lemma("gesungen", "ADJ"), "🎤", {
				source: { meaning: "Verbal", target: singen },
			}),
			options([
				[
					singen,
					{
						breakdown: {
							morphemes: [
								piece(
									"sing",
									shadow("sing", "Root", "Morpheme"),
								),
								piece(
									"en",
									shadow("-en", "Ending", "Morpheme"),
								),
							],
						},
					},
				],
			]),
		);
		expect(morphemeSection(sung)[1]).toBe(
			`${MARKER}ge|[[Worter/s/sin/sing/sing|sung]]|en`,
		);
	});

	it("leaves the section out of a Reading with neither a Breakdown nor a Source", () => {
		const body = render(
			recordsOf(kohle, "🪨", {
				translations: { en: [[{ kind: "Text", text: "coal" }]] },
			}),
		);
		expect(body).not.toContain("note_block_title_morpheme");
		expect(body).not.toContain(MORPHEMES_LINE_CLASS);
	});
});

describe("Breakdown lines and the codec", () => {
	const note = kohlekraftwerkOf(kraftwerk);
	const stored = options([
		[
			kraftwerk,
			{
				breakdown: {
					constituents: [
						piece("Kraft", kraft),
						piece("werk", shadow("Werk", "NOUN")),
					],
				},
			},
		],
	]);

	it("parses back from the metadata alone, and a round trip gives the same note", () => {
		const serialized = Result.getOrThrow(
			serializeReadingNote(note.records, note.reading, stored),
		);
		const parsed = parseReading(serialized);
		expect(valid(parsed.data)).toEqual(
			readingNoteDataOf(note.records, note.reading),
		);
		expect(freeformTexts(parsed)).toEqual([]);
		expect(
			Result.getOrThrow(
				serializeReadingNote(note.records, note.reading, {
					...stored,
					previous: parsed.document,
				}),
			),
		).toEqual(serialized);
	});

	it("keeps the user's text around the lines, and re-renders them when a part's Breakdown arrives", () => {
		const before = Result.getOrThrow(
			serializeReadingNote(note.records, note.reading, options()),
		);
		const chunk = `[[${KRAFTWERK_LEMMA}|kraftwerk]]`;
		expect(before.body).toContain(`${MARKER}${KOHLE}|${chunk}\n`);
		// The user writes under the Morpheme section.
		const edited = before.body.replace(
			`[[${KRAFTWERK_LEMMA}|Kraftwerk]]\n`,
			`[[${KRAFTWERK_LEMMA}|Kraftwerk]]\n${KOHLE} + Kraft + Werk, my own split\n`,
		);
		expect(edited).not.toBe(before.body);
		const parsed = parseReading({ ...before, body: edited });
		expect(freeformTexts(parsed)).toEqual([
			`${KOHLE} + Kraft + Werk, my own split`,
		]);
		const after = Result.getOrThrow(
			serializeReadingNote(note.records, note.reading, {
				...stored,
				previous: parsed.document,
			}),
		);
		expect(after.body).toContain(
			`${MARKER}${KOHLE}|[[Worter/de/Lexeme/NOUN/Fem/k/kra/kraft/Kraft|kraft]]|[[Worter/w/wer/werk/werk|werk]]`,
		);
		expect(after.body).not.toContain(chunk);
		expect(after.body).toContain("Kraft + Werk, my own split");
		expect(after.metadata.knowledge).toEqual(before.metadata.knowledge);
	});
});
