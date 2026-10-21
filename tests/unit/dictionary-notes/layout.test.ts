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
import { derivedProjections } from "@textfresser/lemma-note-projections";
import {
	fahren,
	fahrenReading,
	kohlekraftwerk,
	kohlekraftwerkReading,
	mutter,
	mutterNut,
	mutterParent,
} from "./layout-fixtures";

/**
 * Golden notes in the user's dictionary layout (#103, #104), split across
 * a Lemma note and its Reading notes (#112), with the plugin's interim
 * German tables and tags (TODO(#120): the German Inflection Pack).
 */

const options = derivedProjections;
const title = (kind: string, text: string) =>
	`<span class="note_block_title note_block_title_${kind}">${text}</span>`;
const KONTEXTE = title("kontexte", "Deine Kontexte");
const NOTE = title("kontexte", "Note");
const FLEXION = title("flexion", "Flexion");
const TAGS = title("tags", "Tags");
const TRANSLATIONS = title("translations", "Übersetzung");

describe("a Reading note reads as the user's dictionary example", () => {
	it("lays out a noun with relations, morphemes and two Attestations", () => {
		expect(renderReadingNote(kohlekraftwerk, kohlekraftwerkReading, options))
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
${title("morpheme", "Morpheme")}
[[Worter/k/koh/kohle/kohle|Kohle]]|[[Worter/k/kra/kraft/kraft|Kraft]]|[[Worter/w/wer/werk/werk|Werk]]
${TRANSLATIONS}
coal-fired power plant
${FLEXION}
![[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk#^t|Kohlekraftwerk]]
${TAGS}
#noun/neuter
`);
	});

	it("lays out a strong verb, its principal parts only in its Lemma note's table", () => {
		expect(renderReadingNote(fahren, fahrenReading, options))
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
		expect(renderReadingNote(mutter, mutterParent, options))
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
		expect(renderReadingNote(mutter, mutterNut, options)).toContain(
			`${FLEXION}\n![[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter#^t-eb48dc8c|Mutter]]\n`,
		);
	});
});

describe("a Lemma note shows its Readings, tables and met Surfaces", () => {
	it("Mutter 👩 / 🔩: one table per Licence Group, each its own Obsidian block", () => {
		expect(renderLemmaNote(mutter, options)).toBe(`die [[Worter/m/mut/mutte/mutter|Mutter]]

[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter|👩]]
[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/🔩 Mutter|🔩]]

${FLEXION}

👩
N: die Mutter, die Mütter
A: die Mutter, die Mütter
G: der Mutter, der Mütter
D: der Mutter, den Müttern
^t-8ed83aad

🔩
N: die Mutter, die Muttern
A: die Mutter, die Muttern
G: der Mutter, der Muttern
D: der Mutter, den Muttern
^t-eb48dc8c

${title("surfaces", "Surfaces encountered so far")}
- Mütter: Nom.Pl ^s-95e50a29
- Muttern: Acc.Pl ^s-b41162c0
`);
	});

	it("a single Licence Group's table is ^t", () => {
		expect(renderLemmaNote(kohlekraftwerk, options)).toBe(`das [[Worter/k/koh/kohle/kohlekraftwerk|Kohlekraftwerk]]

[[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/🏭 Kohlekraftwerk|🏭]]

${FLEXION}

🏭
N: das Kohlekraftwerk, die Kohlekraftwerke
A: das Kohlekraftwerk, die Kohlekraftwerke
G: des Kohlekraftwerks, der Kohlekraftwerke
D: dem Kohlekraftwerk, den Kohlekraftwerken
^t

${title("surfaces", "Surfaces encountered so far")}
- Kohlekraftwerken: Dat.Pl ^s-8baa5baa
`);
		expect(renderLemmaNote(fahren, options)).toContain(`${FLEXION}

🚗
Präsens: ich fahre, du fährst, er fährt, wir fahren, ihr fahrt, sie fahren
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren
Konjunktiv II: ich führe, du führest, er führe, wir führen, ihr führet, sie führen
Partizip II: gefahren
^t
`);
	});
});

describe("the golden notes round-trip", () => {
	for (const [name, records, readings] of [
		["Kohlekraftwerk", kohlekraftwerk, [kohlekraftwerkReading]],
		["fahren", fahren, [fahrenReading]],
		["Mutter", mutter, [mutterParent, mutterNut]],
	] as const)
		it(`${name}: parse → serialize gives the same notes`, () => {
			const lemma = serializeLemmaNote(records, options);
			const lemmaParse = parseLemmaNote(lemma, { language: "de" });
			expect(lemmaParse.data.ok).toBe(true);
			expect(
				serializeLemmaNote(records, {
					...options,
					previous: lemmaParse.document,
				}),
			).toEqual(lemma);
			for (const reading of readings) {
				const note = serializeReadingNote(records, reading, options);
				const parsed = parseReadingNote(note, { language: "de" });
				expect(parsed.data.ok).toBe(true);
				expect(
					serializeReadingNote(records, reading, {
						...options,
						previous: parsed.document,
					}),
				).toEqual(note);
			}
		});
});
