/**
 * The scripted dumgen of the `classify-breakdown` scenarios, shared with
 * their in-process twin (`tests/integration/classify/classify-breakdown.test.ts`),
 * which proves the scripts break each Reading down through the real dumgen
 * without Obsidian.
 *
 * Breakdowns (#264): a Reading's Knowledge run asks for its Source first,
 * then `segment.inConstituents`, then `segment.inMorphemes` for a bottom
 * word, and its Reading note shows them under the Morpheme heading. Both
 * segmenters and the Source answer from jev, so the scripts answer them
 * by stage (`<stage>:<id>`): the stages reuse ids, and `f_1`, a Noul in
 * the Sentence's `candidates`, is a headword Choice in `breakdown-forms`.
 *
 * - The compound story. jev weighs no Source for Kohlekraftwerk or
 *   Kraftwerk (`formation` None), picks each one's fourth cut (`a3`:
 *   `Kohle + kraftwerk`, `Kraft + werk`), weighs its first part a word, so
 *   no cranberry Root, routes it to NOUN, and picks the first headword of
 *   each part (`Kohle`, `Kraftwerk`; `Kraft`, `Werk`). Both nouns are
 *   neuter, since jev answers `gender` once for the story.
 * - The conversion story. jev weighs every word a conversion; Luna writes
 *   laufen as Lauf's base, jev confirms the direction, and Luna writes no
 *   base for laufen, so its segmenters run: jev picks no cut, and its
 *   morphemes `lauf · en` come from code, unasked.
 * - The settled story is the compound story with `formation` unscripted:
 *   jev's last option, Unresolved, holds both segmenters and settles the
 *   Reading.
 */
import { expect } from "bun:test";
import { linkTo, TITLES, visible } from "./dictionary-layout";

/** The jev stages and Luna stages a Reading's Source and Breakdown ask. */
export const BREAKDOWN_STAGES = {
	jev: [
		"sourceFormation",
		"sourceJudgment",
		"breakdown-analysis",
		"breakdown-words",
		"breakdown-routes",
		"breakdown-forms",
		"breakdown-senses",
		"breakdown-morphemes",
	],
	luna: ["sourceBase"],
} as const;

/** The jev answers every story shares: the Sentence and a used noun's grammar. */
const SENTENCE_AND_NOUN = {
	archaic: "Current",
	case: "Nom",
	coverage: "Full",
	nounKind: "Ordinary",
	number: "Sing",
	orthography: "None",
	plurality: "HasPlural",
	r_1_2: "Lexeme/NOUN",
	r_3: "Lexeme/VERB",
	s_article_1: "p2",
	spelling: "Canonical",
} as const;

/** Luna's Knowledge base text, the same for every Reading. */
const BASE_TEXT = {
	definition: [{ output: "Eine Bedeutung im Satz." }],
	relationCandidates: [{ output: [] }],
	transcription: [{ output: "ˈtɛst" }],
	translations: [{ output: [[{ kind: "Text", text: "word" }]] }],
} as const;

/** Luna's Canonical Form of a neuter noun, in one Sentence, after its article. */
const neuter = (
	sentence: string,
	shownArticle: string,
	canonicalForm: string,
	emojiDescription: string,
) => ({
	output: {
		article: "das",
		canonicalForm,
		emojiDescription,
		members: [shownArticle, canonicalForm],
	},
	when: `"sentence":"${sentence}"`,
});

// The compound story.

export const COMPOUND_STORY =
	"Das Kohlekraftwerk raucht. ^0\n\nDas Kraftwerk raucht. ^1\n\nEin Kohlekraftwerk brennt. ^2\n";

export const SELECTIONS = {
	kohlekraftwerk: "Das Kohlekraftwerk",
	kohlekraftwerkAgain: "Ein Kohlekraftwerk",
	kraftwerk: "Das Kraftwerk",
} as const;

const COMPOUND_JEV = {
	...SENTENCE_AND_NOUN,
	"breakdown-analysis:analysis": "a3",
	"breakdown-forms:f_0": "f0",
	"breakdown-forms:f_1": "f0",
	"breakdown-routes:r_0": "Lexeme/NOUN",
	"breakdown-words:w_0": 0.9,
	formGender: "das",
	gender: "das",
} as const;

const COMPOUND_LUNA = {
	...BASE_TEXT,
	canonical: [
		neuter("Das Kohlekraftwerk raucht.", "das", "Kohlekraftwerk", "🏭"),
		neuter("Ein Kohlekraftwerk brennt.", "ein", "Kohlekraftwerk", "🏭"),
		neuter("Das Kraftwerk raucht.", "das", "Kraftwerk", "⚡"),
	],
	plural: [
		{ output: ["Kohlekraftwerke"], when: '"lemma":"Kohlekraftwerk"' },
		{ output: ["Kraftwerke"], when: '"lemma":"Kraftwerk"' },
	],
} as const;

export const COMPOUND_DUMGEN = {
	jev: { ...COMPOUND_JEV, "sourceFormation:formation": "None" },
	luna: COMPOUND_LUNA,
} as const;

/** The compound story with no Source answer: jev leaves every formation Unresolved. */
export const SETTLED_DUMGEN = {
	jev: COMPOUND_JEV,
	luna: COMPOUND_LUNA,
} as const;

const KOHLE_FOLDER = "Worter/de/Lexeme/NOUN/Neut/k/koh/kohle";
const KRAFT_FOLDER = "Worter/de/Lexeme/NOUN/Neut/k/kra/kraft";

/** Where each note of the compound story lives (ADR-0015). */
export const COMPOUND_PATHS = {
	kohlekraftwerkLemma: `${KOHLE_FOLDER}/Kohlekraftwerk.md`,
	kohlekraftwerkReading: `${KOHLE_FOLDER}/🏭 Kohlekraftwerk.md`,
	kraftwerkLemma: `${KRAFT_FOLDER}/Kraftwerk.md`,
	kraftwerkReading: `${KRAFT_FOLDER}/⚡ Kraftwerk.md`,
} as const;

/** The Crossroad note a pending part's link lands on, by spelling. */
export const PART_CROSSROADS = {
	en: "Worter/-/-en/-en/-en.md",
	kohle: "Worter/k/koh/kohle/kohle.md",
	kraft: "Worter/k/kra/kraft/kraft.md",
	kraftwerk: "Worter/k/kra/kraft/kraftwerk.md",
	lauf: "Worter/l/lau/lauf/lauf.md",
	laufen: "Worter/l/lau/laufe/laufen.md",
	werk: "Worter/w/wer/werk/werk.md",
} as const;

// The conversion story.

export const CONVERSION_STORY =
	"Der Lauf endet. ^0\n\nEin Lauf beginnt. ^1\n\nEr läuft. ^2\n";

export const CONVERSION_SELECTIONS = {
	lauf: "Der Lauf",
	laufAgain: "Ein Lauf",
	laufen: "läuft",
} as const;

export const CONVERSION_DUMGEN = {
	jev: {
		...SENTENCE_AND_NOUN,
		citation: "Used",
		formGender: "der",
		gender: "der",
		mood: "Ind",
		person: "3",
		r_1: "Lexeme/PRON",
		r_2: "Lexeme/VERB",
		"sourceFormation:formation": "Conversion",
		"sourceJudgment:direction": "Formed",
		tense: "Pres",
		verbForm: "Fin",
	},
	luna: {
		...BASE_TEXT,
		canonical: [
			{
				output: {
					article: "der",
					canonicalForm: "Lauf",
					emojiDescription: "🏃",
					members: ["der", "Lauf"],
				},
				when: '"sentence":"Der Lauf endet."',
			},
			{
				output: {
					article: "der",
					canonicalForm: "Lauf",
					emojiDescription: "🏃",
					members: ["ein", "Lauf"],
				},
				when: '"sentence":"Ein Lauf beginnt."',
			},
			{
				output: {
					canonicalForm: "laufen",
					emojiDescription: "👟",
					members: ["laufen"],
				},
				when: '"text":"läuft"',
			},
		],
		plural: [{ output: ["Läufe"], when: '"lemma":"Lauf"' }],
		sourceBase: [
			{ output: { base: "laufen", kind: "VERB" }, when: '"lemma":"Lauf"' },
			{ output: { base: null }, when: '"lemma":"laufen"' },
		],
	},
} as const;

/** Where each note of the conversion story lives (ADR-0015). */
export const CONVERSION_PATHS = {
	laufenLemma: "Worter/de/Lexeme/VERB/l/lau/laufe/laufen.md",
	laufenReading: "Worter/de/Lexeme/VERB/l/lau/laufe/👟 laufen.md",
	laufLemma: "Worter/de/Lexeme/NOUN/Masc/l/lau/lauf/Lauf.md",
	laufReading: "Worter/de/Lexeme/NOUN/Masc/l/lau/lauf/🏃 Lauf.md",
} as const;

// What the notes show.

const TITLE_LINE = /^<span class="note_block_title /u;

/**
 * The lines of a Reading note's Morpheme section, between its title and
 * the next section's, or undefined when the note shows none.
 */
export function morphemeLines(
	note: string | undefined,
): readonly string[] | undefined {
	const lines = visible(note).split("\n");
	const start = lines.indexOf(TITLES.morpheme);
	if (start < 0) return undefined;
	const end = lines.findIndex(
		(line, at) => at > start && TITLE_LINE.test(line),
	);
	return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** The morphemes line: an empty hover anchor, then each morpheme's link. */
export const morphemesLine = (
	...pieces: readonly (readonly [path: string, shown: string])[]
) =>
	`<span class="tf-morphemes"></span>${pieces.map(([path, shown]) => linkTo(path, shown)).join("|")}`;

/** The constituents line: each part's link, joined by ` + `. */
export const constituentsLine = (
	...pieces: readonly (readonly [path: string, shown: string])[]
) => pieces.map(([path, shown]) => linkTo(path, shown)).join(" + ");

/** The Source line: `← ` and the base's link. */
export const sourceLine = (path: string, shown: string) =>
	`← ${linkTo(path, shown)}`;

/** Asserts the Reading note's Morpheme section sits after its Note and before its Übersetzung. */
export function expectMorphemeSection(
	note: string | undefined,
	lines: readonly string[],
): void {
	expect(morphemeLines(note)).toEqual(lines);
	const text = visible(note);
	expect(text.indexOf(TITLES.note)).toBeLessThan(
		text.indexOf(TITLES.morpheme),
	);
	expect(text.indexOf(TITLES.morpheme)).toBeLessThan(
		text.indexOf(TITLES.uebersetzung),
	);
}

/** The hidden metadata's Reading-note record. */
export function readingMetadata(
	note: string | undefined,
): Readonly<Record<string, unknown>> {
	const json = /<section id="textfresser_meta_keep_me_invisible">\n(\{.*\})\n<\/section>/su.exec(
		note ?? "",
	)?.[1];
	if (json === undefined) throw new Error(`No hidden metadata in:\n${note}`);
	const parsed = JSON.parse(json) as { readingNote?: Record<string, unknown> };
	if (parsed.readingNote === undefined)
		throw new Error(`No Reading-note metadata in:\n${note}`);
	return parsed.readingNote;
}

/** How many of a scripted dumgen's requests were Source or Breakdown requests, by stage. */
export function breakdownRequests(
	requests:
		| {
				readonly jev: Readonly<Record<string, number>>;
				readonly luna: Readonly<Record<string, number>>;
		  }
		| null
		| undefined,
): Readonly<Record<string, number>> {
	return Object.fromEntries([
		...BREAKDOWN_STAGES.jev.map((stage) => [
			`jev:${stage}`,
			requests?.jev[stage] ?? 0,
		]),
		...BREAKDOWN_STAGES.luna.map((stage) => [
			`luna:${stage}`,
			requests?.luna[stage] ?? 0,
		]),
	]);
}
