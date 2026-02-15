import { describe, expect, it } from "bun:test";
import { buildLinguisticUnitMeta } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import type { LemmaResult } from "../../../../src/commanders/textfresser/commands/lemma/types";

function makeLemmaResult(overrides: Partial<LemmaResult> = {}): LemmaResult {
	return {
		attestation: {
			source: {
				path: {
					basename: "Haus",
					extension: "md",
					kind: "MdFile",
					pathParts: ["Worter"],
				},
				ref: "![[Test#^1|^]]",
				textRaw: "Die Häuser sind alt.",
				textWithOnlyTargetMarked: "Die [Häuser] sind alt.",
			},
			target: {
				surface: "Häuser",
			},
		},
		disambiguationResult: null,
		emojiDescription: ["🏠"],
		genus: "Neutrum",
		ipa: "haʊ̯s",
		lemma: "Haus",
		linguisticUnit: "Lexem",
		nounClass: "Common",
		pos: "Noun",
		surfaceKind: "Lemma",
		...overrides,
	};
}

describe("buildLinguisticUnitMeta", () => {
	it("builds Lexem lemma metadata with full noun features", () => {
		const result = buildLinguisticUnitMeta("LX-LM-NOUN-1", makeLemmaResult());

		expect(result).toEqual({
			kind: "Lexem",
			surface: {
				features: {
					genus: "Neutrum",
					nounClass: "Common",
					pos: "Noun",
				},
				lemma: "Haus",
				surfaceKind: "Lemma",
			},
		});
	});

	it("builds Lexem inflected metadata with ref features", () => {
		const result = buildLinguisticUnitMeta(
			"LX-IN-NOUN-1",
			makeLemmaResult({
				surfaceKind: "Inflected",
			}),
		);

		expect(result).toEqual({
			kind: "Lexem",
			surface: {
				features: { pos: "Noun" },
				lemma: "Haus",
				lemmaRef: "LX-LM-NOUN-1",
				surface: "Häuser",
				surfaceKind: "Inflected",
			},
		});
	});

	it("builds Phrasem metadata from phrasemeFeatures", () => {
		const result = buildLinguisticUnitMeta(
			"PH-LM-1",
			makeLemmaResult({
				lemma: "auf jeden Fall",
				linguisticUnit: "Phrasem",
				nounClass: undefined,
				phrasemeFeatures: {
					phrasemeKind: "Collocation",
					strength: "Frozen",
				},
				pos: undefined,
				surfaceKind: "Lemma",
			}),
		);

		expect(result).toEqual({
			kind: "Phrasem",
			surface: {
				features: {
					phrasemeKind: "Collocation",
					strength: "Frozen",
				},
				lemma: "auf jeden Fall",
				surfaceKind: "Lemma",
			},
		});
	});

	it("returns undefined for Morphem (currently out of scope)", () => {
		const result = buildLinguisticUnitMeta(
			"MO-LM-1",
			makeLemmaResult({
				lemma: "auf-",
				linguisticUnit: "Morphem",
				nounClass: undefined,
				pos: undefined,
			}),
		);

		expect(result).toBeUndefined();
	});
});
