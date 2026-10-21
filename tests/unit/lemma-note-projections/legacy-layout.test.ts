import { describe, expect, it } from "bun:test";
import {
	type LemmaNoteData,
	type Projections,
	parse,
	serialize,
} from "@textfresser/lemma-note-codec";
import { derivedProjections } from "@textfresser/lemma-note-projections";
import type { ReadingEntry } from "dumdict";
import type * as Dumling from "dumling/types";

const shadow = (canonicalForm: string) => ({
	nodeKind: "unitShadow" as const,
	unitShadow: {
		canonicalForm,
		family: "Lexeme" as const,
		kind: "NOUN" as const,
		language: "de" as const,
	},
});

const noun = (
	canonicalForm: string,
	gender: "Fem" | "Masc" | "Neut",
): Dumling.Lemma<"de", "Lexeme", "NOUN"> => ({
	canonicalForm,
	coreFeatures: { gender },
	family: "Lexeme",
	kind: "NOUN",
	language: "de",
	unitKind: "Lemma",
});

function noteData(
	lemma: Dumling.Lemma<"de">,
	entries: readonly (Partial<ReadingEntry<"de">> & {
		readonly emojiDescription: string;
	})[],
): LemmaNoteData<"de"> {
	return {
		lemmaRecord: { lemma },
		ownedSurfaceEntries: [],
		pendingRelations: [],
		readingEntries: entries.map(({ emojiDescription, ...entry }) => ({
			attestations: [],
			attestedTranslations: [],
			notes: "",
			...entry,
			reading: {
				emojiDescription,
				lemma,
				unitKind: "Reading",
			} as Dumling.Reading<"de">,
		})),
	};
}

const kohlekraftwerk = noteData(noun("Kohlekraftwerk", "Neut"), [
	{
		attestations: ["![[Atom#^13|^]]", "![[Atom#^14|^]]"],
		emojiDescription: "🏭",
		knowledge: {
			morphologicalTree: {
				root: {
					children: [
						shadow("Kohle"),
						{
							children: [shadow("Kraft"), shadow("Werk")],
							nodeKind: "structure",
						},
					],
					nodeKind: "structure",
				},
			},
			plural: ["Kohlekraftwerke"],
			semanticRelations: {
				antonym: [noun("Windrad", "Neut")],
				nearSynonym: [noun("Industrieanlage", "Fem"), noun("Fabrik", "Fem")],
				synonym: [noun("Kraftwerk", "Neut")],
				targetKind: "lemma",
			},
			transcription: "ˈkoːləˌkraftvɛɐ̯k",
			translations: { en: ["coal-fired power plant"] },
		},
	},
]);

const fahrenLemma: Dumling.Lemma<"de", "Lexeme", "VERB"> = {
	canonicalForm: "fahren",
	coreFeatures: { hasSepPrefix: null, lexicallyReflexive: null },
	family: "Lexeme",
	kind: "VERB",
	language: "de",
	unitKind: "Lemma",
};

// The principal parts texteater#1218 stores (dumcorpus gold).
const fahren = noteData(fahrenLemma, [
	{
		attestations: ["![[Ankunft#^3|^]]"],
		attestedTranslations: ["drive", "drove"],
		emojiDescription: "🚗",
		knowledge: {
			conjugationClass: ["Strong"],
			pastParticiple: ["gefahren"],
			presentSingular: {
				first: ["fahre"],
				second: ["fährst"],
				third: ["fährt"],
			},
			preterite: ["fuhr"],
			subjunctivePast: ["führe"],
			transcription: "ˈfaːʁən",
			translations: { en: ["drive", "ride", "go"] },
		},
	},
]);

const braunkohlekraftwerk = noun("Braunkohlekraftwerk", "Neut");

/** The derived hooks, and the inverse relation the store would project. */
const projections: Projections<"de"> = {
	...derivedProjections,
	inverseRelations: ({ entry, lemma }) =>
		lemma.canonicalForm === "Kohlekraftwerk"
			? [
					{
						provenance: "inferred",
						relation: "hyponym",
						source: entry.reading as never,
						target: braunkohlekraftwerk as never,
					},
				]
			: [],
};

const render = (data: LemmaNoteData<"de">) =>
	serialize(undefined, data, { projections });

/** parse → serialize, which must give the same note back. */
function reserialize(markdown: string): string {
	const parsed = parse(markdown, { language: "de" });
	if (!parsed.data.ok)
		throw new Error(
			parsed.data.issues.map((issue) => issue.message).join("; "),
		);
	return serialize(parsed.document, parsed.data.data, { projections });
}

/**
 * What reading view and Live Preview show: the note without its
 * comment-only marker lines.
 */
const visible = (markdown: string) =>
	markdown
		.split("\n")
		.filter((line) => !/^%%tf.*%%$/u.test(line))
		.join("\n");

const title = (kind: string, text: string) =>
	`<span class="entry_section_title entry_section_title_${kind}">${text}</span>`;

describe("a Lemma note reads as the legacy dictionary notes did", () => {
	it("lays out a noun with two Attestations", () => {
		expect(visible(render(kohlekraftwerk))).toBe(`
🏭 das [[Worter/de/Lexeme/NOUN/Neut/Kohlekraftwerk|Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k](https://youglish.com/pronounce/Kohlekraftwerk/german) ^r-089e0c9e

${title("kontexte", "Kontexte")}
![[Atom#^13|^]]
![[Atom#^14|^]]

${title("synonyme", "Semantische Beziehungen")}
= [[Worter/de/Lexeme/NOUN/Neut/Kraftwerk|Kraftwerk]]
≈ [[Worter/de/Lexeme/NOUN/Fem/Industrieanlage|Industrieanlage]], [[Worter/de/Lexeme/NOUN/Fem/Fabrik|Fabrik]]
≠ [[Worter/de/Lexeme/NOUN/Neut/Windrad|Windrad]]
⊂ [[Worter/de/Lexeme/NOUN/Neut/Braunkohlekraftwerk|Braunkohlekraftwerk]]

${title("translations", "Übersetzung")}
coal-fired power plant

${title("morpheme", "Morpheme")}
[[Worter/de/Shadow/Lexeme/NOUN/Kohle|Kohle]]|[[Worter/de/Shadow/Lexeme/NOUN/Kraft|Kraft]]|[[Worter/de/Shadow/Lexeme/NOUN/Werk|Werk]]

${title("tags", "Tags")}
#noun/neuter

${title("flexion", "Flexion")}
N: das Kohlekraftwerk, die Kohlekraftwerke
A: das Kohlekraftwerk, die Kohlekraftwerke
G: des Kohlekraftwerks, der Kohlekraftwerke
D: dem Kohlekraftwerk, den Kohlekraftwerken

${title("notizen", "Notizen")}
`);
	});

	it("lays out a strong verb, its principal parts shown only in Flexion", () => {
		expect(visible(render(fahren))).toBe(`
🚗 [[Worter/de/Lexeme/VERB/fahren|fahren]], [ˈfaːʁən](https://youglish.com/pronounce/fahren/german) ^r-475b92e8

${title("kontexte", "Kontexte")}
![[Ankunft#^3|^]]

${title("translations", "Übersetzung")}
drive, ride, go
*drove*

${title("tags", "Tags")}
#verb/strong

${title("flexion", "Flexion")}
Präsens: ich fahre, du fährst, er fährt, wir fahren, ihr fahrt, sie fahren
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren
Konjunktiv II: ich führe, du führest, er führe, wir führen, ihr führet, sie führen
Partizip II: gefahren

${title("notizen", "Notizen")}
`);
	});

	it("keeps the payloads in comment lines with no link in them", () => {
		const markdown = render(kohlekraftwerk);
		const markers = markdown
			.split("\n")
			.filter((line) => line.startsWith("%%tf"));
		expect(markers.join("\n")).not.toContain("[[");
		// Each Attestation embed shows once, in the Kontexte section.
		expect(markdown.split("![[Atom#^13|^]]")).toHaveLength(2);
		expect(markdown.split("![[Atom#^14|^]]")).toHaveLength(2);
	});

	it("separates the Readings of one Lemma as the legacy entries were", () => {
		const mutter = noun("Mutter", "Fem");
		const markdown = render(
			noteData(mutter, [
				{
					emojiDescription: "👩",
					knowledge: { plural: ["Mütter"], translations: { en: ["mother"] } },
				},
				{
					emojiDescription: "🔩",
					knowledge: { plural: ["Muttern"], translations: { en: ["nut"] } },
				},
			]),
		);
		const lines = visible(markdown).split("\n");
		const nut = lines.findIndex((line) => line.startsWith("🔩 die [["));
		expect(lines.slice(nut - 4, nut)).toEqual([
			title("notizen", "Notizen"),
			"",
			"***",
			"***",
		]);
		expect(lines.filter((line) => line === "***")).toHaveLength(2);
		expect(reserialize(markdown)).toBe(markdown);
	});

	it("keeps what a user writes under Notizen there, once", () => {
		const markdown = render(kohlekraftwerk);
		const written = markdown.replace(
			`${title("notizen", "Notizen")}\n`,
			`${title("notizen", "Notizen")}\n\nSeen at the Rhine.\n\nAsk about Braunkohle.\n`,
		);
		expect(written).not.toBe(markdown);
		const again = reserialize(written);
		expect(again).toBe(written);
		expect(again.split("Seen at the Rhine.")).toHaveLength(2);
		expect(again.split(title("notizen", "Notizen"))).toHaveLength(2);
		expect(again.split("![[Atom#^13|^]]")).toHaveLength(2);
		const before = parse(markdown, { language: "de" }).data;
		const after = parse(again, { language: "de" }).data;
		expect(after.ok && after.data).toEqual(before.ok && before.data);
	});

	it("moves text typed into another section under Notizen", () => {
		const markdown = render(kohlekraftwerk);
		const typed = markdown.replace(
			"coal-fired power plant\n",
			"coal-fired power plant\nmy own gloss\n",
		);
		const again = reserialize(typed);
		expect(again).toContain(
			`${title("notizen", "Notizen")}\n\nmy own gloss\n`,
		);
		expect(reserialize(again)).toBe(again);
	});
});
