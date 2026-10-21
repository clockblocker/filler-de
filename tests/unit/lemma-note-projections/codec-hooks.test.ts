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

/** A section's title line, as the codec renders it. */
const title = (kind: string, text: string) =>
	`<span class="note_block_title note_block_title_${kind}">${text}</span>`;

// The derived hooks fit the codec's projection hooks with no adapter.
const derived = derivedProjections satisfies Projections<"de">;

/**
 * The principal parts each Lemma's table is derived from. Reading Knowledge
 * no longer holds them (texteater#1226) and the codec passes none, so these
 * hooks hand them in until #120 renders the batteries' tables.
 */
const PRINCIPAL_PARTS: Readonly<Record<string, PrincipalParts>> = {
	aufpassen: { conjugationClass: ["Weak"], preterite: ["passte auf"] },
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
	Tag: { plural: ["Tage"] },
};

const projections: Projections<"de"> = {
	inflection: (context) =>
		derived.inflection({
			...context,
			principalParts: PRINCIPAL_PARTS[context.lemma.canonicalForm],
		}),
	tags: (context) =>
		derived.tags({
			...context,
			principalParts: PRINCIPAL_PARTS[context.lemma.canonicalForm],
		}),
};

function noteData(
	lemma: Dumling.Lemma<"de">,
	emojiDescription: string,
	knowledge?: ReadingEntry<"de">["knowledge"],
): LemmaNoteData<"de"> {
	return {
		lemmaRecord: { lemma },
		ownedSurfaceEntries: [],
		pendingRelations: [],
		readingEntries: [
			{
				attestationLinks: [],
				attestedTranslations: [],
				...(knowledge === undefined ? {} : { knowledge }),
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
);

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
);

describe("the codec renders the derived projections", () => {
	it("renders no Flexion for a noun or verb without its principal parts (#120)", () => {
		for (const data of [tag, aufpassen, fahren]) {
			const markdown = serialize(undefined, data, { projections: derived });
			expect(markdown).not.toContain(title("flexion", "Flexion"));
			expect(markdown).not.toContain("%%tf:inflection");
		}
		expect(serialize(undefined, aufpassen, { projections: derived })).toContain(
			`${title("tags", "Tags")}\n#verb/separable\n`,
		);
	});

	it("renders a strong verb's principal parts in its table", () => {
		const markdown = serialize(undefined, fahren, { projections });
		// A form spelled as the Lemma links to its note.
		expect(markdown).toContain(`${title("flexion", "Flexion")}
Präsens: ich fahre, du fährst, er fährt, wir [[Worter/de/Lexeme/VERB/fahren|fahren]], ihr fahrt, sie [[Worter/de/Lexeme/VERB/fahren|fahren]]
Präteritum: ich fuhr, du fuhrst, er fuhr, wir fuhren, ihr fuhrt, sie fuhren
Konjunktiv II: ich führe, du führest, er führe, wir führen, ihr führet, sie führen
Partizip II: gefahren`);
	});

	it("renders a noun's Flexion and Tags sections", () => {
		const markdown = serialize(undefined, tag, { projections });
		expect(markdown).toContain(`${title("flexion", "Flexion")}
N: der [[Worter/de/Lexeme/NOUN/Masc/Tag|Tag]], die Tage
A: den [[Worter/de/Lexeme/NOUN/Masc/Tag|Tag]], die Tage
G: des Tages, der Tage
D: dem [[Worter/de/Lexeme/NOUN/Masc/Tag|Tag]], den Tagen`);
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
