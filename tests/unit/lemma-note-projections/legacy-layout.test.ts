import { describe, expect, it } from "bun:test";
import {
	type LemmaNoteData,
	type Projections,
	parse,
	serialize,
} from "@textfresser/lemma-note-codec";
import {
	derivedProjections,
	type PrincipalParts,
} from "@textfresser/lemma-note-projections";
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
	entries: readonly (Partial<
		Omit<ReadingEntry<"de">, "attestationLinks" | "reading">
	> & {
		readonly emojiDescription: string;
		/** The refs of the Reading's Attestation Links. */
		readonly refs?: readonly string[];
	})[],
): LemmaNoteData<"de"> {
	return {
		lemmaRecord: { lemma },
		ownedSurfaceEntries: [],
		pendingRelations: [],
		readingEntries: entries.map(({ emojiDescription, refs, ...entry }) => {
			const reading = {
				emojiDescription,
				lemma,
				unitKind: "Reading",
			} as Dumling.Reading<"de">;
			return {
				attestationLinks: (refs ?? []).map((ref) => ({
					reading,
					ref,
					surfaceId: null,
				})),
				attestedTranslations: [],
				notes: "",
				...entry,
				reading,
			};
		}),
	};
}

const kohlekraftwerk = noteData(noun("Kohlekraftwerk", "Neut"), [
	{
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
			semanticRelations: {
				antonym: [noun("Windrad", "Neut")],
				nearSynonym: [noun("Industrieanlage", "Fem"), noun("Fabrik", "Fem")],
				synonym: [noun("Kraftwerk", "Neut")],
				targetKind: "lemma",
			},
			transcription: "ˈkoːləˌkraftvɛɐ̯k",
			translations: { en: ["coal-fired power plant"] },
		},
		refs: ["![[Atom#^13|^]]", "![[Atom#^14|^]]"],
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

const fahren = noteData(fahrenLemma, [
	{
		attestedTranslations: ["drive", "drove"],
		emojiDescription: "🚗",
		knowledge: {
			transcription: "ˈfaːʁən",
			translations: { en: ["drive", "ride", "go"] },
		},
		refs: ["![[Ankunft#^3|^]]"],
	},
]);

const braunkohlekraftwerk = noun("Braunkohlekraftwerk", "Neut");

/**
 * The principal parts each Lemma's table is derived from. Reading Knowledge
 * no longer holds them (texteater#1226) and the codec passes none, so the
 * hooks below hand them in until #120 renders the batteries' tables.
 */
const PRINCIPAL_PARTS: Readonly<Record<string, PrincipalParts>> = {
	// The principal parts texteater#1218 stored (dumcorpus gold).
	fahren: {
		conjugationClass: ["Strong"],
		pastParticiple: ["gefahren"],
		presentSingular: {
			first: ["fahre"],
			second: ["fährst"],
			third: ["fährt"],
		},
		preterite: ["fuhr"],
		subjunctivePast: ["führe"],
	},
	Kohlekraftwerk: { plural: ["Kohlekraftwerke"] },
	Mutter: { plural: ["Mütter"] },
};

/** The derived hooks, and the inverse relation the store would project. */
const projections: Projections<"de"> = {
	inflection: (context) =>
		derivedProjections.inflection({
			...context,
			principalParts: PRINCIPAL_PARTS[context.lemma.canonicalForm],
		}),
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
	tags: (context) =>
		derivedProjections.tags({
			...context,
			principalParts: PRINCIPAL_PARTS[context.lemma.canonicalForm],
		}),
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
	`<span class="note_block_title note_block_title_${kind}">${text}</span>`;

const NOTE = title("kontexte", "Note");
const PLACEHOLDER = "*You can write here*";

/** The note's freeform Blocks, as parse reads them. */
const freeformOf = (markdown: string) =>
	parse(markdown, { language: "de" })
		.document.parts.flatMap((part) => part.blocks)
		.filter((block) => block.type === "freeform")
		.map((block) => block.raw);

describe("a Lemma note reads as the user's dictionary example", () => {
	it("lays out a noun with two Attestations", () => {
		expect(visible(render(kohlekraftwerk))).toBe(`
🏭 das [[Worter/de/Lexeme/NOUN/Neut/Kohlekraftwerk|Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german) ^r-089e0c9e

${title("kontexte", "Deine Kontexte")}
![[Atom#^13|^]]

![[Atom#^14|^]]
${NOTE}
${PLACEHOLDER}


${title("synonyme", "Semantische Beziehungen")}
= [[Worter/de/Lexeme/NOUN/Neut/Kraftwerk|Kraftwerk]]
≈ [[Worter/de/Lexeme/NOUN/Fem/Industrieanlage|Industrieanlage]], [[Worter/de/Lexeme/NOUN/Fem/Fabrik|Fabrik]]
≠ [[Worter/de/Lexeme/NOUN/Neut/Windrad|Windrad]]
⊂ [[Worter/de/Lexeme/NOUN/Neut/Braunkohlekraftwerk|Braunkohlekraftwerk]]
${title("morpheme", "Morpheme")}
[[Worter/k/koh/kohle/kohle|Kohle]]|[[Worter/k/kra/kraft/kraft|Kraft]]|[[Worter/w/wer/werk/werk|Werk]]
${title("translations", "Übersetzung")}
coal-fired power plant
${title("flexion", "Flexion")}
N: das [[Worter/de/Lexeme/NOUN/Neut/Kohlekraftwerk|Kohlekraftwerk]], die Kohlekraftwerke
A: das [[Worter/de/Lexeme/NOUN/Neut/Kohlekraftwerk|Kohlekraftwerk]], die Kohlekraftwerke
G: des Kohlekraftwerks, der Kohlekraftwerke
D: dem [[Worter/de/Lexeme/NOUN/Neut/Kohlekraftwerk|Kohlekraftwerk]], den Kohlekraftwerken
${title("tags", "Tags")}
#noun/neuter
`);
	});

	it("lays out a strong verb, its principal parts shown only in Flexion", () => {
		expect(visible(render(fahren))).toBe(`
🚗 [[Worter/de/Lexeme/VERB/fahren|fahren]], [ˈfaːʁən ♫](https://youglish.com/pronounce/fahren/german) ^r-475b92e8

${title("kontexte", "Deine Kontexte")}
![[Ankunft#^3|^]]
${NOTE}
${PLACEHOLDER}


${title("translations", "Übersetzung")}
drive, ride, go
*drove*
${title("flexion", "Flexion")}
Präsens: ich fahre, du fährst, er fährt, wir [[Worter/de/Lexeme/VERB/fahren|fahren]], ihr fahrt, sie [[Worter/de/Lexeme/VERB/fahren|fahren]]
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren
Konjunktiv II: ich führe, du führest, er führe, wir führen, ihr führet, sie führen
Partizip II: gefahren
${title("tags", "Tags")}
#verb/strong
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

	it("reads the blank line between Attestation embeds as part of their rendering", () => {
		const markdown = render(kohlekraftwerk);
		expect(markdown).toContain("![[Atom#^13|^]]\n\n![[Atom#^14|^]]\n");
		// Nothing of the generated note, the placeholder included, is freeform.
		expect(freeformOf(markdown)).toEqual([]);
		expect(reserialize(markdown)).toBe(markdown);
	});

	it("keeps the data when a user edits the Kontexte lines", () => {
		const markdown = render(kohlekraftwerk);
		const edited = markdown.replace(
			"![[Atom#^13|^]]\n\n![[Atom#^14|^]]\n",
			"![[Atom#^13|^]]\n![[Atom#^14|^]]\n",
		);
		expect(edited).not.toBe(markdown);
		// The edited lines turn freeform, and the data stays as it was.
		expect(freeformOf(edited).join("")).toContain("![[Atom#^14|^]]");
		const before = parse(markdown, { language: "de" }).data;
		const after = parse(edited, { language: "de" }).data;
		expect(after.ok && after.data).toEqual(before.ok && before.data);
	});

	it("separates the Readings of one Lemma as the old entries were", () => {
		const mutter = noun("Mutter", "Fem");
		const markdown = render(
			noteData(mutter, [
				{
					emojiDescription: "👩",
					knowledge: { translations: { en: ["mother"] } },
				},
				{
					emojiDescription: "🔩",
					knowledge: { translations: { en: ["nut"] } },
				},
			]),
		);
		const lines = visible(markdown).split("\n");
		const nut = lines.findIndex((line) => line.startsWith("🔩 die [["));
		expect(lines.slice(nut - 4, nut)).toEqual([
			"#noun/feminine",
			"",
			"***",
			"***",
		]);
		expect(lines.filter((line) => line === "***")).toHaveLength(2);
		expect(lines.filter((line) => line === PLACEHOLDER)).toHaveLength(2);
		expect(reserialize(markdown)).toBe(markdown);
	});

	it("replaces the Note placeholder with what a user writes in its place", () => {
		const markdown = render(kohlekraftwerk);
		const written = markdown.replace(
			`${PLACEHOLDER}\n`,
			"Seen at the Rhine.\n\nAsk about Braunkohle.\n",
		);
		expect(written).not.toBe(markdown);
		const again = reserialize(written);
		expect(visible(again)).toContain(
			`${NOTE}\nSeen at the Rhine.\n\nAsk about Braunkohle.\n\n\n${title("synonyme", "Semantische Beziehungen")}`,
		);
		expect(again).not.toContain(PLACEHOLDER);
		expect(again.split("Seen at the Rhine.")).toHaveLength(2);
		expect(again.split(NOTE)).toHaveLength(2);
		expect(again.split("![[Atom#^13|^]]")).toHaveLength(2);
		expect(reserialize(again)).toBe(again);
		const before = parse(markdown, { language: "de" }).data;
		const after = parse(again, { language: "de" }).data;
		expect(after.ok && after.data).toEqual(before.ok && before.data);
	});

	it("drops the placeholder once a user writes under it", () => {
		const markdown = render(kohlekraftwerk);
		const written = markdown.replace(
			`${PLACEHOLDER}\n`,
			`${PLACEHOLDER}\nSeen at the Rhine.\n`,
		);
		const again = reserialize(written);
		expect(visible(again)).toContain(`${NOTE}\nSeen at the Rhine.\n`);
		expect(again).not.toContain(PLACEHOLDER);
		expect(reserialize(again)).toBe(again);
	});

	it("never keeps the placeholder as user text, nor writes it twice", () => {
		const markdown = render(kohlekraftwerk);
		// An edit that leaves only the placeholder's words, such as a
		// trailing space, breaks its seal and turns it freeform.
		const touched = markdown.replace(`${PLACEHOLDER}\n`, `${PLACEHOLDER} \n`);
		expect(freeformOf(touched).join("")).toContain(PLACEHOLDER);
		const again = reserialize(touched);
		expect(again).toBe(markdown);
		expect(again.split(PLACEHOLDER)).toHaveLength(2);
		expect(freeformOf(again)).toEqual([]);
	});

	it("brings the placeholder back when the user's text is gone", () => {
		const markdown = render(kohlekraftwerk);
		const written = reserialize(
			markdown.replace(`${PLACEHOLDER}\n`, "Seen at the Rhine.\n"),
		);
		expect(reserialize(written.replace("Seen at the Rhine.\n", ""))).toBe(
			markdown,
		);
	});

	it("moves text typed into another section under the Note title", () => {
		const markdown = render(kohlekraftwerk);
		const typed = markdown.replace(
			"coal-fired power plant\n",
			"coal-fired power plant\nmy own gloss\n",
		);
		const again = reserialize(typed);
		expect(again).toContain(`${NOTE}\nmy own gloss\n\n\n`);
		expect(again).not.toContain(PLACEHOLDER);
		expect(reserialize(again)).toBe(again);
	});
});
