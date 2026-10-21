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

/** A section's title line, as the codec renders it. */
const title = (kind: string, text: string) =>
	`<span class="entry_section_title entry_section_title_${kind}">${text}</span>`;

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

// The principal parts texteater#1218 stores (dumcorpus gold).
const fahren = noteData(
	{
		canonicalForm: "fahren",
		coreFeatures: { hasSepPrefix: null, lexicallyReflexive: null },
		family: "Lexeme",
		kind: "VERB",
		language: "de",
		unitKind: "Lemma",
	},
	"🚲",
	{
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
);

describe("the codec renders the derived projections", () => {
	it("renders a strong verb's stored principal parts in its table", () => {
		const markdown = serialize(undefined, fahren, { projections });
		// The principal parts are data the Flexion table shows, as the
		// legacy notes did; their own Blocks render nothing.
		expect(markdown).toContain(
			'%%tf:present_singular {"first":["fahre"],"second":["fährst"],"third":["fährt"]}%%\n',
		);
		expect(markdown).toContain('%%tf:past_participle ["gefahren"]%%\n');
		expect(markdown).toContain(`${title("flexion", "Flexion")}
Präsens: ich fahre, du fährst, er fährt, wir fahren, ihr fahrt, sie fahren
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren
Konjunktiv II: ich führe, du führest, er führe, wir führen, ihr führet, sie führen
Partizip II: gefahren`);
	});

	it("renders a noun's Flexion and Tags sections", () => {
		const markdown = serialize(undefined, tag, { projections });
		expect(markdown).toContain(`${title("flexion", "Flexion")}
N: der Tag, die Tage
A: den Tag, die Tage
G: des Tages, der Tage
D: dem Tag, den Tagen`);
		expect(markdown).toContain(`${title("tags", "Tags")}\n#noun/masculine`);
	});

	it("renders a weak verb's table and Tags", () => {
		const markdown = serialize(undefined, aufpassen, { projections });
		expect(markdown).toContain("Partizip II: aufgepasst");
		expect(markdown).toContain("Imperativ: pass auf!, passt auf!, passen Sie auf!");
		expect(markdown).toContain(
			`${title("tags", "Tags")}\n#verb/separable #verb/weak`,
		);
	});

	for (const [name, data] of [
		["Tag", tag],
		["aufpassen", aufpassen],
		["fahren", fahren],
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
