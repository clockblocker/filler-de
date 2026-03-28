import { describe, expect, it } from "bun:test";
import { entryIdentity } from "../../../../../src/commanders/textfresser/core/entries/entry-identity";

describe("entryIdentity", () => {
	it("round-trips lexem ids through build and parse", () => {
		const id = entryIdentity.build({
			index: 3,
			pos: "Verb",
			surfaceKind: "Lemma",
			unitKind: "Lexem",
		});

		expect(id).toBe("LX-LM-VERB-3");
		expect(entryIdentity.parse(id)).toEqual({
			index: 3,
			pos: "Verb",
			posTag: "VERB",
			surfaceKind: "Lemma",
			surfaceKindTag: "LM",
			unitKind: "Lexem",
			unitKindTag: "LX",
		});
	});

	it("round-trips non-lexem ids without a pos tag", () => {
		const id = entryIdentity.build({
			index: 2,
			surfaceKind: "Variant",
			unitKind: "Phrasem",
		});

		expect(id).toBe("PH-VA-2");
		expect(entryIdentity.parse(id)).toEqual({
			index: 2,
			pos: undefined,
			posTag: undefined,
			surfaceKind: "Variant",
			surfaceKindTag: "VA",
			unitKind: "Phrasem",
			unitKindTag: "PH",
		});
	});

	it("allocates next index within the current prefix space only", () => {
		const prefix = entryIdentity.buildPrefix("Lexem", "Lemma", "Noun");
		const nextIndex = entryIdentity.nextIndex(
			[
				"LX-LM-NOUN-1",
				"LX-LM-NOUN-4",
				"LX-INF-NOUN-9",
				"LX-LM-VERB-7",
				"PH-LM-5",
			],
			prefix,
		);

		expect(prefix).toBe("LX-LM-NOUN-");
		expect(nextIndex).toBe(5);
	});
});
