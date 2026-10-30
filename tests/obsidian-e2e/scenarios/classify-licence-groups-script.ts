/**
 * The scripted dumgen of the `classify-licence-groups` scenario, shared
 * with its in-process twin
 * (`tests/integration/classify/classify-licence-groups.test.ts`), which
 * proves the script resolves through the real dumgen without Obsidian.
 *
 * Two senses of Mutter that license different plurals (batteries ADR
 * 0038): "Die Mutter lacht." is 👩 Mutter, whose plural Luna writes as
 * Mütter, and "Eine Mutter klemmt." is 🔩 Mutter. jev answers each question
 * by id, so the unscripted Reading judge picks its last option, NoMatch,
 * and Luna's draft 🔩 becomes a second Reading; the unscripted licence
 * judge takes no stored plural for it (its Noul defaults to 0.1), so Luna
 * writes Muttern. The Readings' licences differ, so the Lemma note holds one
 * table per Licence Group, and each Reading note embeds its own.
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

export const STORY = "Die Mutter lacht. ^0\n\nEine Mutter klemmt. ^1\n";

export const PARENT_SELECTION = "Die Mutter";
export const NUT_SELECTION = "Eine Mutter";

export const LICENCE_GROUPS_DUMGEN = {
	jev: {
		archaic: "Current",
		case: "Nom",
		coverage: "Full",
		formGender: "die",
		gender: "die",
		nounKind: "Ordinary",
		number: "Sing",
		orthography: "None",
		plural: "s1",
		plurality: "HasPlural",
		r_1_2: "Lexeme/NOUN",
		r_3: "Lexeme/VERB",
		s_article_1: "p2",
		spelling: "Canonical",
	},
	luna: {
		canonical: [
			{
				output: {
					article: "die",
					canonicalForm: "Mutter",
					emojiDescription: "👩",
					members: ["die", "Mutter"],
				},
				when: '"sentence":"Die Mutter lacht."',
			},
			{
				output: {
					article: "die",
					canonicalForm: "Mutter",
					emojiDescription: "🔩",
					members: ["eine", "Mutter"],
				},
				when: '"sentence":"Eine Mutter klemmt."',
			},
		],
		definition: [{ output: "Eine Bedeutung im Satz." }],
		plural: [
			{ output: ["Muttern"], when: '"emojiDescription":"🔩"' },
			{ output: ["Mütter"], when: '"emojiDescription":"👩"' },
		],
		relationCandidates: [{ output: [] }],
		transcription: [{ output: "ˈmʊtɐ" }],
		translations: [
			{
				output: [[{ kind: "Text", text: "слово" }]],
				when: '"language":"ru"',
			},
			{ output: [[{ kind: "Text", text: "word" }]] },
		],
	},
} as const;

const MUTTER_FOLDER = "Worter/de/Lexeme/NOUN/Fem/m/mut/mutte";
export const LEMMA_PATH = `${MUTTER_FOLDER}/Mutter.md`;
export const PARENT_PATH = `${MUTTER_FOLDER}/👩 Mutter.md`;
export const NUT_PATH = `${MUTTER_FOLDER}/🔩 Mutter.md`;
export const CROSSROAD_PATH = "Worter/m/mut/mutte/mutter.md";

/**
 * The dictionary after both Classifies, by vault path: one Lemma note with
 * a table per Licence Group, each captioned with its Reading's emoji, and
 * each Reading note embedding its own group's table.
 */
export function expectLicenceGroupNotes(
	notes: Readonly<Record<string, string | undefined>>,
): void {
	expect(Object.keys(notes).sort()).toEqual(
		[CROSSROAD_PATH, LEMMA_PATH, NUT_PATH, PARENT_PATH].sort(),
	);
	expectHiddenMetadata(notes[LEMMA_PATH], "lemmaNote");
	expectHiddenMetadata(notes[PARENT_PATH], "readingNote");
	expectHiddenMetadata(notes[NUT_PATH], "readingNote");
	expectHiddenMetadata(notes[CROSSROAD_PATH], "crossroadNote");

	const mutter = linkTo(LEMMA_PATH, "Mutter");
	expectInOrder(visible(notes[LEMMA_PATH]), [
		`die ${linkTo(CROSSROAD_PATH, "Mutter")}\n`,
		`${linkTo(PARENT_PATH, "👩")}\n${linkTo(NUT_PATH, "🔩")}\n`,
		`${TITLES.flexion}\n`,
		"\n👩\n",
		"\n🔩\n",
		TITLES.begegneteFormen,
	]);
	const parent = tableOf(notes[LEMMA_PATH], "👩");
	const nut = tableOf(notes[LEMMA_PATH], "🔩");
	expect(parent.lines).toEqual([
		`N: die ${mutter}, die Mütter`,
		`A: die ${mutter}, die Mütter`,
		`G: der ${mutter}, der Mütter`,
		`D: der ${mutter}, den Müttern`,
	]);
	expect(nut.lines).toEqual([
		`N: die ${mutter}, die Muttern`,
		`A: die ${mutter}, die Muttern`,
		`G: der ${mutter}, der Muttern`,
		`D: der ${mutter}, den Muttern`,
	]);
	// Each group's table is its own Obsidian block, `^t-<hash>`.
	expect(parent.blockId).toMatch(/^t-[0-9a-f]{8}$/u);
	expect(nut.blockId).toMatch(/^t-[0-9a-f]{8}$/u);
	expect(parent.blockId).not.toBe(nut.blockId);

	for (const [path, emoji, blockId, block] of [
		[PARENT_PATH, "👩", parent.blockId, "^0"],
		[NUT_PATH, "🔩", nut.blockId, "^1"],
	] as const)
		expectInOrder(visible(notes[path]), [
			`${emoji} die ${mutter}, `,
			`${TITLES.deineKontexte}\n![[Story#${block}|^`,
			`${TITLES.flexion}\n![[${linkpath(LEMMA_PATH)}#^${blockId}|Mutter]]\n`,
			`${TITLES.tags}\n#noun/feminine`,
		]);

	expect(visible(notes[CROSSROAD_PATH])).toBe(
		`${TITLES.eintraege}\n- die ${mutter}: ${linkTo(PARENT_PATH, "👩")} ${linkTo(NUT_PATH, "🔩")}`,
	);
}
