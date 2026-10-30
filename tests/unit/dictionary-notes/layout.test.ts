import { describe, expect, it } from "bun:test";
import {
	NOTE_PLACEHOLDER,
	parseLemmaNote,
	parseReadingNote,
	renderLemmaNote,
	renderReadingNote,
	serializeLemmaNote,
	serializeReadingNote,
} from "@textfresser/lemma-note-codec";
import { Result } from "effect";
import { dictionaryProjections } from "../../../src/stateless-helpers/dictionary-projections";
import {
	abfahren,
	abfahrenReading,
	dieser,
	dieserReading,
	fahren,
	fahrenReading,
	kohlekraftwerk,
	kohlekraftwerkReading,
	melken,
	melkenCow,
	melkenFleece,
	mutter,
	mutterConflict,
	mutterNut,
	mutterParent,
	nounRecords,
	schnell,
	schnellReading,
} from "./layout-fixtures";

/**
 * Golden notes in the user's dictionary layout (#103, #104), split across
 * a Lemma note and its Reading notes (#112), with the German Inflection
 * Pack's tables drawn in the dictionary's line style, and the plugin's
 * tags (#120).
 */

const options = dictionaryProjections;
const title = (kind: string, text: string) =>
	`<span class="note_block_title note_block_title_${kind}">${text}</span>`;
const KONTEXTE = title("kontexte", "Deine Kontexte");
const NOTE = title("kontexte", "Note");
const FLEXION = title("flexion", "Flexion");
const TAGS = title("tags", "Tags");
const TRANSLATIONS = title("translations", "Übersetzung");
const SURFACES = title("surfaces", "Begegnete Formen");
const MUTTER = "[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]]";

/** The Lemma note's lines from `^id`'s table up to its Block ID. */
function tableBlock(body: string, blockId: string): string {
	const lines = body.split("\n");
	const end = lines.indexOf(`^${blockId}`);
	if (end < 0) throw new Error(`No table ^${blockId}`);
	let start = end;
	while (start > 0 && (lines[start - 1] ?? "") !== "") start--;
	return lines.slice(start, end + 1).join("\n");
}

describe("a Reading note reads as the user's dictionary example", () => {
	it("lays out a noun with relations and two Attestations", () => {
		expect(Result.getOrThrow(renderReadingNote(kohlekraftwerk, kohlekraftwerkReading, options)))
			.toBe(`🏭 das [[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk|Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)

${KONTEXTE}
![[Atom#^13|^]]

![[Atom#^14|^]]
${NOTE}
${NOTE_PLACEHOLDER}


${title("synonyme", "Semantische Beziehungen")}
= [[Worter/de/Lexeme/NOUN/Neut/k/kra/kraft/Kraftwerk|Kraftwerk]]
≈ [[Worter/de/Lexeme/NOUN/Fem/i/ind/indus/Industrieanlage|Industrieanlage]], [[Worter/de/Lexeme/NOUN/Fem/f/fab/fabri/Fabrik|Fabrik]]
≠ [[Worter/de/Lexeme/NOUN/Neut/w/win/windr/Windrad|Windrad]]
${TRANSLATIONS}
coal-fired power plant
${FLEXION}
![[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk#^t|Kohlekraftwerk]]
${TAGS}
#noun/neuter
`);
	});

	it("lays out a strong verb, its principal parts only in its Lemma note's table", () => {
		expect(Result.getOrThrow(renderReadingNote(fahren, fahrenReading, options)))
			.toBe(`🚗 [[Worter/de/Lexeme/VERB/f/fah/fahre/fahren|fahren]], [ˈfaːʁən ♫](https://youglish.com/pronounce/fahren/german)

${KONTEXTE}
![[Ankunft#^3|^]]
${NOTE}
${NOTE_PLACEHOLDER}


${TRANSLATIONS}
drive, ride, go
*drove*
${FLEXION}
![[Worter/de/Lexeme/VERB/f/fah/fahre/fahren#^t|fahren]]
${TAGS}
#verb/strong
`);
	});

	it("embeds the 👩 Mutter's own Licence Group's table", () => {
		expect(Result.getOrThrow(renderReadingNote(mutter, mutterParent, options)))
			.toBe(`👩 die [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], [ˈmʊtɐ ♫](https://youglish.com/pronounce/Mutter/german)

${KONTEXTE}
![[Familie#^2|^]]
${NOTE}
${NOTE_PLACEHOLDER}


${TRANSLATIONS}
mother
${FLEXION}
![[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter#^t-8ed83aad|Mutter]]
${TAGS}
#noun/feminine
`);
		expect(Result.getOrThrow(renderReadingNote(mutter, mutterNut, options))).toContain(
			`${FLEXION}\n![[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter#^t-eb48dc8c|Mutter]]\n`,
		);
	});
});

describe("a Lemma note shows its Readings, tables and met Surfaces", () => {
	it("Mutter 👩 / 🔩: one table per Licence Group, each its own Obsidian block", () => {
		expect(Result.getOrThrow(renderLemmaNote(mutter, options))).toBe(`die [[Worter/m/mut/mutte/mutter|Mutter]]

[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter|👩]]
[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/🔩 Mutter|🔩]]

${FLEXION}

👩
N: die ${MUTTER}, die Mütter
A: die ${MUTTER}, die Mütter
G: der ${MUTTER}, der Mütter
D: der ${MUTTER}, den Müttern
^t-8ed83aad

🔩
N: die ${MUTTER}, die Muttern
A: die ${MUTTER}, die Muttern
G: der ${MUTTER}, der Muttern
D: der ${MUTTER}, den Muttern
^t-eb48dc8c

${SURFACES}
- Mütter: Nom.Pl ^s-95e50a29
- Muttern: Akk.Pl ^s-b41162c0
`);
	});

	it("marks a Licence Conflict on its Surface's line, never in a table", () => {
		const body = Result.getOrThrow(renderLemmaNote(mutterConflict, options));
		// Muttern met under 👩, whose Licence takes only Mütter: it fits 🔩.
		expect(body).toContain(`${SURFACES}
- Mütter: Nom.Pl ^s-95e50a29
- Muttern: Akk.Pl ⚠ 👩 → 🔩 ^s-b41162c0
`);
		expect(tableBlock(body, "t-8ed83aad")).not.toContain("Muttern");
		expect(tableBlock(body, "t-8ed83aad")).toBe(
			tableBlock(Result.getOrThrow(renderLemmaNote(mutter, options)), "t-8ed83aad"),
		);
	});

	it("a single Licence Group's table is ^t", () => {
		expect(Result.getOrThrow(renderLemmaNote(kohlekraftwerk, options))).toBe(`das [[Worter/k/koh/kohle/kohlekraftwerk|Kohlekraftwerk]]

[[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/🏭 Kohlekraftwerk|🏭]]

${FLEXION}

🏭
N: das [[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk|Kohlekraftwerk]], die Kohlekraftwerke
A: das [[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk|Kohlekraftwerk]], die Kohlekraftwerke
G: des Kohlekraftwerks, der Kohlekraftwerke
D: dem [[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk|Kohlekraftwerk]], den Kohlekraftwerken
^t

${SURFACES}
- Kohlekraftwerken: Dat.Pl ^s-8baa5baa
`);
	});
});

/** Tables with each form spelled as the Lemma linked bare, as the vault's notes link it. */
const bare = { ...options, paths: { lemma: () => undefined } };

describe("the German Inflection Pack's tables in the dictionary's line style", () => {
	it("fahren: one line per tense, the Lemma's own form linked", () => {
		expect(tableBlock(Result.getOrThrow(renderLemmaNote(fahren, bare)), "t")).toBe(`🚗
Präsens: ich fahre, du fährst, er fährt, wir [[fahren]], ihr fahrt, sie [[fahren]]
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren
Konjunktiv II: ich führe, du führest, er führe, wir führen, ihr führet, sie führen
Partizip II: gefahren
^t`);
	});

	it("abfahren: a separable verb's finite forms split off their particle after a Gap", () => {
		const body = Result.getOrThrow(renderLemmaNote(abfahren, bare));
		expect(tableBlock(body, "t")).toBe(`🚉
Präsens: ich fahre … ab, du fährst … ab, er fährt … ab, wir fahren … ab, ihr fahrt … ab, sie fahren … ab
Präteritum: ich fuhr … ab, du fuhrst … ab, er fuhr … ab, wir fuhren … ab, ihr fuhrt … ab, sie fuhren … ab
Konjunktiv II: ich führe … ab, du führest … ab, er führe … ab, wir führen … ab, ihr führet … ab, sie führen … ab
Partizip II: abgefahren
^t`);
		expect(body).toContain(`${SURFACES}\n- fährt ab: Präs.3.Sg ^s-`);
		expect(
			Result.getOrThrow(renderReadingNote(abfahren, abfahrenReading, options)),
		).toContain(
			`${FLEXION}\n![[Worter/de/Lexeme/VERB/ab/a/abf/abfah/abfahren#^t|abfahren]]\n`,
		);
	});

	it("melken: a Free Lemma has one table, its cells holding every licensed form", () => {
		const body = Result.getOrThrow(renderLemmaNote(melken, bare));
		expect(tableBlock(body, "t")).toBe(`🐄 💰
Präsens: ich melke, du melkst / milkst, er melkt / milkt, wir [[melken]], ihr melkt, sie [[melken]]
Präteritum: ich melkte / molk, du melktest / molkst, er melkte / molk, wir melkten / molken, ihr melktet / molkt, sie melkten / molken
Konjunktiv II: ich melkte / mölke, du melktest / mölkest, er melkte / mölke, wir melkten / mölken, ihr melktet / mölket, sie melkten / mölken
Partizip II: gemelkt / gemolken
^t`);
		expect(body).toContain(`${SURFACES}\n- molk: Prät.3.Sg ^s-`);
		for (const reading of [melkenCow, melkenFleece])
			expect(Result.getOrThrow(renderReadingNote(melken, reading, options))).toContain(
				"/melken#^t|melken]]",
			);
	});

	it("schnell: a comparable adjective's comparison, and a declined form in the list", () => {
		const body = Result.getOrThrow(renderLemmaNote(schnell, bare));
		expect(tableBlock(body, "t")).toBe(`⚡
Positiv: [[schnell]]
Komparativ: schneller
Superlativ: am schnellsten
^t`);
		expect(body).toContain(`${SURFACES}
- schneller: Komp ^s-52b1489f
- schnellen: Dat.Sg.m.Pos ^s-cbe769c5
`);
	});

	it("dieser: a determiner stem's columns carry their labels", () => {
		expect(tableBlock(Result.getOrThrow(renderLemmaNote(dieser, bare)), "t")).toBe(`👉
N: [[dieser]] (m), dieses (n), diese (f), diese (Pl)
A: diesen (m), dieses (n), diese (f), diese (Pl)
G: dieses (m), dieses (n), [[dieser]] (f), [[dieser]] (Pl)
D: diesem (m), diesem (n), [[dieser]] (f), diesen (Pl)
^t`);
	});
});

/**
 * The 5 Flexion tables of the dev vault's generated entries (#62, #75),
 * copied from `Worter/` with their wikilinks: 40 cells.
 */
const VAULT_TABLES: readonly {
	readonly lemma: string;
	readonly gender: "Fem" | "Masc" | "Neut";
	readonly plural: string;
	readonly flexion: string;
}[] = [
	{
		flexion: `N: der [[Tag]], die [[Tage]]
A: den [[Tag]], die [[Tage]]
G: des [[Tages]], der [[Tage]]
D: dem [[Tag]], den [[Tagen]]`,
		gender: "Masc",
		lemma: "Tag",
		plural: "Tage",
	},
	{
		flexion: `N: das [[Team]], die [[Teams]]
A: das [[Team]], die [[Teams]]
G: des [[Teams]], der [[Teams]]
D: dem [[Team]], den [[Teams]]`,
		gender: "Neut",
		lemma: "Team",
		plural: "Teams",
	},
	{
		flexion: `N: das [[Formular]], die [[Formulare]]
A: das [[Formular]], die [[Formulare]]
G: des [[Formulars]], der [[Formulare]]
D: dem [[Formular]], den [[Formularen]]`,
		gender: "Neut",
		lemma: "Formular",
		plural: "Formulare",
	},
	{
		flexion: `N: der [[Fahrer]], die [[Fahrer]]
A: den [[Fahrer]], die [[Fahrer]]
G: des [[Fahrers]], der [[Fahrer]]
D: dem [[Fahrer]], den [[Fahrern]]`,
		gender: "Masc",
		lemma: "Fahrer",
		plural: "Fahrer",
	},
	{
		flexion: `N: die [[Fahrkarte]], die [[Fahrkarten]]
A: die [[Fahrkarte]], die [[Fahrkarten]]
G: der [[Fahrkarte]], der [[Fahrkarten]]
D: der [[Fahrkarte]], den [[Fahrkarten]]`,
		gender: "Fem",
		lemma: "Fahrkarte",
		plural: "Fahrkarten",
	},
];

describe("the dev vault's Flexion tables, through the German Inflection Pack", () => {
	it("hold 40 cells", () => {
		expect(
			VAULT_TABLES.flatMap(({ flexion }) =>
				flexion.split("\n").flatMap((row) => row.split(": ")[1]?.split(", ")),
			),
		).toHaveLength(40);
	});

	for (const { flexion, gender, lemma, plural } of VAULT_TABLES)
		it(`${lemma}: every cell as the vault shows it, only the forms spelled as the Lemma linked`, () => {
			const records = nounRecords(lemma, gender, plural);
			expect(tableBlock(Result.getOrThrow(renderLemmaNote(records, bare)), "t")).toBe(
				[
					"📘",
					flexion.replace(/\[\[([^\]]+)\]\]/gu, (whole, form) =>
						form === lemma ? whole : form,
					),
					"^t",
				].join("\n"),
			);
		});
});

describe("the golden notes round-trip", () => {
	for (const [name, records, readings] of [
		["Kohlekraftwerk", kohlekraftwerk, [kohlekraftwerkReading]],
		["fahren", fahren, [fahrenReading]],
		["Mutter", mutter, [mutterParent, mutterNut]],
		["Mutter with a Licence Conflict", mutterConflict, [mutterParent, mutterNut]],
		["abfahren", abfahren, [abfahrenReading]],
		["melken", melken, [melkenCow, melkenFleece]],
		["schnell", schnell, [schnellReading]],
		["dieser", dieser, [dieserReading]],
	] as const)
		it(`${name}: parse → serialize gives the same notes`, () => {
			const lemma = Result.getOrThrow(serializeLemmaNote(records, options));
			const lemmaParse = parseLemmaNote(lemma, { language: "de" });
			expect(lemmaParse.data.ok).toBe(true);
			expect(
				Result.getOrThrow(serializeLemmaNote(records, {
					...options,
					previous: lemmaParse.document,
				})),
			).toEqual(lemma);
			for (const reading of readings) {
				const note = Result.getOrThrow(serializeReadingNote(records, reading, options));
				const parsed = parseReadingNote(note, { language: "de" });
				expect(parsed.data.ok).toBe(true);
				expect(
					Result.getOrThrow(serializeReadingNote(records, reading, {
						...options,
						previous: parsed.document,
					})),
				).toEqual(note);
			}
		});
});
