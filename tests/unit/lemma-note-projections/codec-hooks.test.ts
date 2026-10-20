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

// The derived hooks fit the codec's projection hooks with no adapter.
const projections = derivedProjections satisfies Projections<"de">;

function noteData(
	lemma: Dumling.Lemma<"de">,
	emojiDescription: string,
	knowledge: ReadingEntry<"de">["knowledge"],
): LemmaNoteData<"de"> {
	return {
		lemmaRecord: { lemma },
		ownedSurfaceEntries: [],
		pendingRelations: [],
		readingEntries: [
			{
				attestations: [],
				attestedTranslations: [],
				knowledge,
				notes: "",
				reading: {
					emojiDescription,
					lemma,
					unitKind: "Reading",
				} as Dumling.Reading<"de">,
			},
		],
	};
}

const tag = noteData(
	{
		canonicalForm: "Tag",
		coreFeatures: { gender: "Masc" },
		family: "Lexeme",
		kind: "NOUN",
		language: "de",
		unitKind: "Lemma",
	},
	"🌞",
	{ plural: ["Tage"] },
);

const aufpassen = noteData(
	{
		canonicalForm: "aufpassen",
		coreFeatures: { hasSepPrefix: "auf", lexicallyReflexive: null },
		family: "Lexeme",
		kind: "VERB",
		language: "de",
		unitKind: "Lemma",
	},
	"👀",
	{ conjugationClass: ["Weak"], preterite: ["passte auf"] },
);

describe("the codec renders the derived projections", () => {
	it("renders a noun's Inflection and Tags Blocks", () => {
		const markdown = serialize(undefined, tag, { projections });
		expect(markdown).toContain(`*Inflection*
N: der Tag, die Tage
A: den Tag, die Tage
G: des Tages, der Tage
D: dem Tag, den Tagen`);
		expect(markdown).toContain("*Tags*: #noun/masculine");
	});

	it("renders a weak verb's table and Tags", () => {
		const markdown = serialize(undefined, aufpassen, { projections });
		expect(markdown).toContain("Partizip II: aufgepasst");
		expect(markdown).toContain("Imperativ: pass auf!, passt auf!, passen Sie auf!");
		expect(markdown).toContain("*Tags*: #verb/separable #verb/weak");
	});

	for (const [name, data] of [
		["Tag", tag],
		["aufpassen", aufpassen],
	] as const)
		it(`${name}: a round trip leaves the data unchanged`, () => {
			const first = parse(serialize(undefined, data, { projections }), {
				language: "de",
			});
			if (!first.data.ok)
				throw new Error(
					first.data.issues.map((issue) => issue.message).join("; "),
				);
			expect(first.data.data).toEqual(data);
			const again = serialize(first.document, first.data.data, {
				projections,
			});
			expect(again).toBe(serialize(undefined, data, { projections }));
		});
});
