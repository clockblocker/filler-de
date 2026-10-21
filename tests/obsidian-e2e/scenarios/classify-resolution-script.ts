/**
 * The scripted dumgen of the `classify-resolution` scenario, shared with its
 * in-process twin (`tests/integration/classify/classify-resolution.test.ts`),
 * which proves the script resolves through the real dumgen without Obsidian.
 *
 * "Der Hund fängt heute auf jeden Fall an." segments into the noun unit
 * Der Hund (Segments 0 and 2), the separable verb fängt … an (4 and 14),
 * heute (6) and the Locution auf jeden Fall (8, 10 and 12). jev answers by
 * question id, so the grammar answers serve every unit that asks them; Luna
 * writes each unit's Canonical Form, drafting its Emoji Description, and the
 * Knowledge base text and the noun's plural. The other structural aspects
 * stay unscripted and fail as values. The twins also share what the
 * dictionary looks like after the first Classify (`expectFirstClassifyNotes`).
 */
import { expect } from "bun:test";
import {
	expectHiddenMetadata,
	expectInOrder,
	linkpath,
	linkTo,
	TITLES,
	tableOf,
	visible,
} from "./dictionary-layout";

export const STORY =
	"Der Hund fängt heute auf jeden Fall an. ^0\n\nDer Hund schläft. ^1\n";

export const FIRST_SELECTION = "Hund fängt heute auf jeden Fall an";
export const SECOND_SELECTION = "Hund schläft";

export const CLASSIFY_RESOLUTION_DUMGEN = {
	jev: {
		archaic: "Current",
		citation: "Used",
		comparable: "No",
		coverage: "Full",
		degree: "Pos",
		e_5_6: 0.95,
		e_5_7: 0.95,
		e_6_7: 0.95,
		f_5: 0.95,
		f_6: 0.95,
		f_7: 0.95,
		formGender: "der",
		gender: "der",
		governed_m1: "Free",
		mood: "Ind",
		nounKind: "Ordinary",
		number: "Sing",
		orthography: "None",
		person: "3",
		plurality: "HasPlural",
		prefix: "p0",
		r_1_2: "Lexeme/NOUN",
		r_3_8: "Lexeme/VERB",
		r_4: "Lexeme/ADV",
		r_5_6_7: "Locution/ADV",
		s_article_1: "p2",
		s_particle_8: "p3",
		spelling: "Canonical",
		tense: "Pres",
		verbForm: "Fin",
	},
	luna: {
		canonical: [
			{
				output: {
					article: "der",
					canonicalForm: "Hund",
					emojiDescription: "🐕",
					members: ["der", "Hund"],
				},
				when: '"text":"Hund"',
			},
			{
				output: {
					canonicalForm: "anfangen",
					emojiDescription: "🏁",
					members: ["fangen", "an"],
				},
				when: '"text":"fängt"',
			},
			{
				output: {
					canonicalForm: "heute",
					emojiDescription: "📅",
					members: ["heute"],
				},
				when: '"text":"heute"',
			},
			{
				output: {
					canonicalForm: "auf jeden Fall",
					emojiDescription: "✅",
					members: ["auf", "jeden", "Fall"],
				},
				when: '"text":"jeden"',
			},
		],
		definition: [{ output: "Eine Bedeutung im Satz." }],
		plural: [{ output: ["Hunde"], when: '"lemma":"Hund"' }],
		relationCandidates: [{ output: [] }],
		transcription: [{ output: "ˈtɛst" }],
		translations: [
			{ output: ["слово"], when: '"language":"ru"' },
			{ output: ["word"] },
		],
	},
} as const;

/** Where each unit's Lemma note lives (ADR-0015). */
export const LEMMA_PATHS = {
	anfangen: "Worter/de/Lexeme/VERB/an/a/anf/anfan/anfangen.md",
	aufJedenFall: "Worter/de/Locution/ADV/a/auf/aufje/auf jeden Fall.md",
	heute: "Worter/de/Lexeme/ADV/h/heu/heute/heute.md",
	hund: "Worter/de/Lexeme/NOUN/Masc/h/hun/hund/Hund.md",
} as const;

/** Where each spelling's Crossroad note lives (ADR-0015), Lemmas' and met Surfaces'. */
export const CROSSROAD_PATHS = {
	anfangen: "Worter/a/anf/anfan/anfangen.md",
	aufJedenFall: "Worter/a/auf/aufje/auf jeden fall.md",
	faengtAn: "Worter/f/fän/fängt/fängt an.md",
	heute: "Worter/h/heu/heute/heute.md",
	hund: "Worter/h/hun/hund/hund.md",
} as const;

/** An occurrence's Attestation Ref in block `^0` of the Story: the block, with the occurrence's key as its alias. */
const KONTEXT_0 = /!\[\[Story#\^0\|\^[0-9a-f]{8}\]\]/u;

/**
 * The dictionary after the first Classify, by vault path, given the
 * Reading notes it linked (Hund, anfangen, heute, auf jeden Fall): exactly
 * the four units' Lemma, Reading and Crossroad notes, the met Surface
 * "fängt an"'s Crossroad included, each with its data in the hidden
 * section, and the layout the user reads (ADR-0015).
 */
export function expectFirstClassifyNotes(
	notes: Readonly<Record<string, string | undefined>>,
	readingPaths: readonly string[],
): void {
	const [hund, anfangen] = readingPaths;
	if (!hund || !anfangen || readingPaths.length !== 4)
		throw new Error("The first Classify links four Reading notes");
	const lemmaPaths = [
		LEMMA_PATHS.hund,
		LEMMA_PATHS.anfangen,
		LEMMA_PATHS.heute,
		LEMMA_PATHS.aufJedenFall,
	];
	expect(Object.keys(notes).sort()).toEqual(
		[...lemmaPaths, ...readingPaths, ...Object.values(CROSSROAD_PATHS)].sort(),
	);
	for (const path of lemmaPaths) expectHiddenMetadata(notes[path], "lemmaNote");
	for (const path of readingPaths)
		expectHiddenMetadata(notes[path], "readingNote");
	for (const path of Object.values(CROSSROAD_PATHS))
		expectHiddenMetadata(notes[path], "crossroadNote");

	// Each Lemma note links the Reading note the Scroll links, which shows
	// the occurrence under Deine Kontexte.
	for (const [index, readingPath] of readingPaths.entries()) {
		expect(notes[readingPath]).toMatch(KONTEXT_0);
		expect(notes[lemmaPaths[index] ?? ""]).toContain(linkpath(readingPath));
	}

	// The Lemma note: its Crossroad, its Readings, its Licence Group's
	// inflection table and the Surfaces met so far.
	const hundLemma = linkTo(LEMMA_PATHS.hund, "Hund");
	expectInOrder(visible(notes[LEMMA_PATHS.hund]), [
		`der ${linkTo(CROSSROAD_PATHS.hund, "Hund")}\n`,
		`${linkTo(hund, "🐕")}\n`,
		TITLES.flexion,
		TITLES.begegneteFormen,
		"\n- Hund: Nom.Sg ^s-",
	]);
	const table = tableOf(notes[LEMMA_PATHS.hund], "🐕");
	expect(table.lines).toEqual([
		`N: der ${hundLemma}, die Hunde`,
		`A: den ${hundLemma}, die Hunde`,
		"G: des Hundes, der Hunde",
		`D: dem ${hundLemma}, den Hunden`,
	]);

	// The Reading note: its sections in order, ending in an embed of its
	// Licence Group's table from the Lemma note.
	expectInOrder(visible(notes[hund]), [
		`🐕 der ${hundLemma}, [ˈtɛst ♫](https://youglish.com/pronounce/Hund/german)\n`,
		`${TITLES.deineKontexte}\n![[Story#^0|^`,
		`${TITLES.note}\n*You can write here*\n`,
		`${TITLES.uebersetzung}\nen: word\nru: слово\n`,
		`${TITLES.definition}\nEine Bedeutung im Satz.\n`,
		`${TITLES.flexion}\n![[${linkpath(LEMMA_PATHS.hund)}#^${table.blockId}|Hund]]\n`,
		`${TITLES.tags}\n#noun/masculine`,
	]);

	// Each Crossroad note lists every Lemma and met Surface of its spelling.
	expect(visible(notes[CROSSROAD_PATHS.hund])).toBe(
		`${TITLES.eintraege}\n- der ${hundLemma}: ${linkTo(hund, "🐕")}`,
	);
	expect(visible(notes[CROSSROAD_PATHS.anfangen])).toBe(
		`${TITLES.eintraege}\n- ${linkTo(LEMMA_PATHS.anfangen, "anfangen")} (VERB): ${linkTo(anfangen, "🏁")}`,
	);
	expect(visible(notes[CROSSROAD_PATHS.faengtAn])).toBe(
		`${TITLES.begegneteFormen}\n- fängt an → ${linkTo(LEMMA_PATHS.anfangen, "anfangen")} (VERB)`,
	);
}
