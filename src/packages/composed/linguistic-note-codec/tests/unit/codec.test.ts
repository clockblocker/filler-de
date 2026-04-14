import { describe, expect, it } from "bun:test";
import {
	LinguisticNoteCodecError,
	type NoteData,
	normalizeDocument,
	parseDataLoose,
	parseDataStrict,
	parseDocumentStrict,
	serializeData,
	serializeDocument,
} from "../../src";

describe("linguistic-note-codec", () => {
	it("reconstructs lemma entries from identity and root metadata", () => {
		const markdown = `:::entry
:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"gehen"}
:::

:::root_meta
{"emojiDescription":["🚶"],"separable":false}
:::

:::relation
{"lexicalRelations":{},"morphologicalRelations":{}}
:::

:::inherent_features
{"features":{"reflex":true,"separable":false}}
:::
:::
`;

		const data = parseDataStrict(markdown);
		expect(data.entries).toHaveLength(1);
		const entry = data.entries[0];
		expect(entry?.kind).toBe("lemma");
		if (entry?.kind !== "lemma") {
			throw new Error("Expected lemma entry");
		}
		expect(entry.lemma).toMatchObject({
			emojiDescription: ["🚶"],
			inherentFeatures: {
				reflex: true,
				separable: false,
			},
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "VERB",
			spelledLemma: "gehen",
		});
	});

	it("reconstructs selection entries from identity and root metadata", () => {
		const markdown = `:::entry
:::header
walking form
:::

:::inflection
{"canonical":{"inflectionalFeatures":{"mood":"Ind","number":"Sing","person":"1","tense":"Pres","verbForm":"Fin"}}}
:::

:::identity
{"entryKind":"selection","language":"German","orthographicStatus":"Standard","surfaceKind":"Inflection","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"gehen","spelledSurface":"gehe"}
:::

:::root_meta
{"emojiDescription":["🚶"]}
:::

:::inherent_features
{"features":{"reflex":true}}
:::
:::
`;

		const data = parseDataStrict(markdown);
		const entry = data.entries[0];
		expect(entry?.kind).toBe("selection");
		if (entry?.kind !== "selection") {
			throw new Error("Expected selection entry");
		}
		expect(entry.selection).toMatchObject({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				inflectionalFeatures: {
					mood: "Ind",
					number: "Sing",
					person: "1",
					tense: "Pres",
					verbForm: "Fin",
				},
				lemma: {
					emojiDescription: ["🚶"],
					inherentFeatures: { reflex: true },
					pos: "VERB",
					spelledLemma: "gehen",
				},
				spelledSurface: "gehe",
				surfaceKind: "Inflection",
			},
		});
	});

	it("rejects missing and duplicate identity blocks in strict mode", () => {
		const missingIdentity = `:::entry
:::header
[[gehen]]
:::
:::
`;
		expectCodecError(
			() => parseDataStrict(missingIdentity),
			"MissingRequiredBlock",
		);

		const duplicateIdentity = `:::entry
:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"gehen"}
:::

:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"laufen"}
:::

:::relation
{"lexicalRelations":{},"morphologicalRelations":{}}
:::

:::inherent_features
{"features":{}}
:::
:::
`;
		expectCodecError(
			() => parseDataStrict(duplicateIdentity),
			"DuplicateBlock",
		);
	});

	it("does not reconstruct canonical roots from header or tags projections", () => {
		const markdown = `:::entry
:::header
🚶 [[gehen]]
:::

:::tags
#German #VERB
:::
:::
`;

		expectCodecError(
			() => parseDataStrict(markdown),
			"MissingRequiredBlock",
		);
	});

	it("preserves freeform markdown through document round-trip", () => {
		const markdown = `:::entry
:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Phraseme","phrasemeKind":"DiscourseFormula","spelledLemma":"auf jeden Fall"}
:::

:::relation
{"lexicalRelations":{}}
:::

Manual note the user wrote.

- keeps bullets
- keeps spacing
:::
`;

		const document = parseDocumentStrict(markdown);
		expect(serializeDocument(document)).toBe(markdown);
	});

	it("ignores typed block order while parsing", () => {
		const markdown = `:::entry
:::translation
to go
:::

:::inherent_features
{"features":{"reflex":true}}
:::

:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"gehen"}
:::

:::relation
{"lexicalRelations":{},"morphologicalRelations":{}}
:::
:::
`;

		const data = parseDataStrict(markdown);
		expect(data.entries[0]).toMatchObject({
			kind: "lemma",
		});
	});

	it("serializes data in canonical block order", () => {
		const data: NoteData = {
			entries: [
				{
					kind: "lemma",
					lemma: {
						inherentFeatures: {
							reflex: true,
							separable: false,
						},
						language: "German",
						lemmaKind: "Lexeme",
						lexicalRelations: {},
						morphologicalRelations: {},
						pos: "VERB",
						spelledLemma: "gehen",
					},
					payload: {
						freeform: [{ markdown: "Manual note.\n" }],
						header: { markdown: "[[gehen]]\n" },
						tags: { markdown: "#German\n" },
						translations: { markdown: "to go\n" },
					},
				},
			],
		};

		const markdown = serializeData(data);
		expect(markdown.indexOf(":::identity")).toBeLessThan(
			markdown.indexOf(":::header"),
		);
		expect(markdown.indexOf(":::header")).toBeLessThan(
			markdown.indexOf(":::translation"),
		);
		expect(markdown.indexOf(":::translation")).toBeLessThan(
			markdown.indexOf(":::relation"),
		);
		expect(markdown.indexOf(":::relation")).toBeLessThan(
			markdown.indexOf(":::inherent_features"),
		);
		expect(markdown.indexOf(":::inherent_features")).toBeLessThan(
			markdown.indexOf(":::tags"),
		);
	});

	it("normalizes duplicate semantic blocks explicitly", () => {
		const markdown = `:::entry
:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"gehen"}
:::

:::relation
{"lexicalRelations":{"synonym":["laufen"]},"morphologicalRelations":{}}
:::

:::relation
{"lexicalRelations":{"hypernym":["Fortbewegung"]},"morphologicalRelations":{"derivedFrom":["Gang"]}}
:::

:::inherent_features
{"features":{}}
:::
:::
`;

		const document = parseDocumentStrict(markdown);
		const normalized = normalizeDocument(document);
		expect(
			normalized.issues.some(
				(issue) => issue.code === "SemanticBlockMerged",
			),
		).toBe(true);
		const relationBlocks = normalized.document.entries[0]?.blocks.filter(
			(block) => block.block === "relation",
		);
		expect(relationBlocks).toHaveLength(1);
		expect(relationBlocks?.[0]).toMatchObject({
			lexicalRelations: {
				hypernym: ["Fortbewegung"],
				synonym: ["laufen"],
			},
			morphologicalRelations: {
				derivedFrom: ["Gang"],
			},
		});
	});

	it("validates reconstructed roots against linguistics schemas", () => {
		const markdown = `:::entry
:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"gehen"}
:::

:::relation
{"lexicalRelations":{},"morphologicalRelations":{}}
:::

:::inherent_features
{"features":{"mood":"Ind"}}
:::
:::
`;

		expectCodecError(() => parseDataStrict(markdown), "InvalidRootDto");
	});

	it("round-trips multi-entry notes through data serialization", () => {
		const markdown = `:::entry
:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Morpheme","morphemeKind":"Prefix","spelledLemma":"ab-"}
:::

:::relation
{"lexicalRelations":{}}
:::
:::
:::entry
:::identity
{"entryKind":"selection","language":"German","orthographicStatus":"Typo","surfaceKind":"Lemma","lemmaKind":"Phraseme","phrasemeKind":"Cliché","spelledLemma":"Zeit ist Geld","spelledSurface":"Zeit ist Gelt"}
:::
:::
`;

		const firstPass = parseDataStrict(markdown);
		const serialized = serializeData(firstPass);
		const secondPass = parseDataStrict(serialized);

		expect(secondPass.entries).toHaveLength(2);
		expect(secondPass.entries[0]?.kind).toBe("lemma");
		expect(secondPass.entries[1]?.kind).toBe("selection");
	});

	it("returns partial invalid entries in loose mode without inventing values", () => {
		const markdown = `:::entry
:::header
🚶 [[gehen]]
:::

:::identity
{"entryKind":"lemma","language":"German","lemmaKind":"Lexeme","pos":"VERB","spelledLemma":"gehen"}
:::

:::inherent_features
{"features":{"mood":"Ind"}}
:::
:::
`;

		const result = parseDataLoose(markdown);
		expect(
			result.issues.some((issue) => issue.code === "InvalidRootDto"),
		).toBe(true);
		expect(result.data.entries[0]).toMatchObject({
			kind: "invalid",
			partialRoot: {
				entryKind: "lemma",
				lemmaKind: "Lexeme",
				spelledLemma: "gehen",
			},
			reconstructionTarget: "lemma",
		});
	});
});

function expectCodecError(
	run: () => unknown,
	code: string,
): LinguisticNoteCodecError {
	try {
		run();
		throw new Error("Expected codec error");
	} catch (error) {
		expect(error).toBeInstanceOf(LinguisticNoteCodecError);
		const codecError = error as LinguisticNoteCodecError;
		expect(codecError.issues.some((issue) => issue.code === code)).toBe(
			true,
		);
		return codecError;
	}
}
