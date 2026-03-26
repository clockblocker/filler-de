import { describe, expect, it } from "bun:test";
import { generateMorphologySection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/morphology-section-generator";
import type { LexicalInfo } from "@textfresser/lexical-generation";

function makeLexicalInfo(
	overrides: Partial<
		Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }>
	> = {},
): Extract<LexicalInfo, { lemma: { linguisticUnit: "Lexem" } }> {
	return {
		core: {
			status: "ready",
			value: {
				emojiDescription: ["🧩"],
				ipa: "unknown",
			},
		},
		features: {
			status: "ready",
			value: {
				genus: "Femininum",
				kind: "noun",
				nounClass: "Common",
				tags: [],
			},
		},
		inflections: { status: "not_applicable" },
		lemma: {
			lemma: "Freiheit",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
		morphemicBreakdown: {
			status: "ready",
			value: {
				morphemes: [{ kind: "Root", lemma: "frei", surface: "frei" }],
			},
		},
		relations: { status: "not_applicable" },
		...overrides,
	};
}

describe("generateMorphologySection", () => {
	it("renders derived-only block", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				morphemicBreakdown: {
					status: "ready",
					value: {
						derivedFrom: {
							derivationType: "suffix_derivation",
							lemma: "frei",
						},
						morphemes: [
							{ kind: "Root", lemma: "frei", surface: "frei" },
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section?.content).toContain("Abgeleitet von:");
		expect(result.section?.content).toContain("[[frei]]");
		expect(result.section?.content).not.toContain("Besteht aus:");
	});

	it("renders compound-only block", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				lemma: {
					lemma: "Küchenfenster",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						compoundedFrom: ["Küche", "Fenster"],
						morphemes: [
							{
								kind: "Root",
								lemma: "Küche",
								surface: "küche",
							},
							{ kind: "Interfix", surface: "n" },
							{
								kind: "Root",
								lemma: "Fenster",
								surface: "fenster",
							},
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section?.content).toContain("Besteht aus:");
		expect(result.section?.content).toContain("[[Küche]] + [[Fenster]]");
		expect(result.section?.content).not.toContain("Abgeleitet von:");
	});

	it("renders mixed output with prefix equation and gloss", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				features: {
					status: "ready",
					value: {
						conjugation: "Regular",
						kind: "verb",
						valency: {
							reflexivity: "NonReflexive",
							separability: "Separable",
						},
					},
				},
				lemma: {
					lemma: "aufpassen",
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						compoundedFrom: ["A", "B"],
						morphemes: [
							{
								kind: "Prefix",
								separability: "Separable",
								surface: "auf",
							},
							{
								kind: "Root",
								lemma: "passen",
								surface: "passen",
							},
						],
					},
				},
			}),
			sourceTranslation: "to pay attention",
			targetLang: "German",
		});

		expect(result.section?.content).not.toContain("Abgeleitet von:");
		expect(result.section?.content).toContain("Besteht aus:");
		expect(result.section?.content).toContain(
			"[[auf-prefix-de|>auf]] + [[passen]] = [[aufpassen]] *(to pay attention)*",
		);
	});

	it("renders inseparable prefix marker in equation", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				features: {
					status: "ready",
					value: {
						conjugation: "Regular",
						kind: "verb",
						valency: {
							reflexivity: "NonReflexive",
							separability: "Inseparable",
						},
					},
				},
				lemma: {
					lemma: "verstehen",
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						morphemes: [
							{
								kind: "Prefix",
								separability: "Inseparable",
								surface: "ver",
							},
							{
								kind: "Root",
								lemma: "stehen",
								surface: "stehen",
							},
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section?.content).toContain(
			"[[ver-prefix-de|ver<]] + [[stehen]] = [[verstehen]]",
		);
		expect(result.section?.content).not.toContain("Abgeleitet von:");
	});

	it("does not build prefix equation for non-verb prefix without separability", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				features: {
					status: "ready",
					value: {
						classification: "Qualitative",
						distribution: "AttributiveAndPredicative",
						gradability: "Gradable",
						kind: "adjective",
						valency: { governedPattern: "None" },
					},
				},
				lemma: {
					lemma: "unklar",
					linguisticUnit: "Lexem",
					posLikeKind: "Adjective",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						derivedFrom: {
							derivationType: "prefix_derivation",
							lemma: "klar",
						},
						morphemes: [
							{ kind: "Prefix", surface: "un" },
							{
								kind: "Root",
								lemma: "klar",
								surface: "klar",
							},
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section?.content).toContain("Abgeleitet von:");
		expect(result.section?.content).toContain("[[klar]]");
		expect(result.section?.content).not.toContain(" = [[unklar]]");
	});

	it("omits section when no morphology fields are available", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				lemma: {
					lemma: "Xenon",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						morphemes: [
							{
								kind: "Root",
								lemma: "Xenon",
								surface: "xenon",
							},
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section).toBeNull();
		expect(result.morphology).toBeUndefined();
	});

	it("does not build separable-prefix equation for nouns", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				lemma: {
					lemma: "Abfahrt",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						derivedFrom: {
							derivationType: "prefix_derivation",
							lemma: "Fahrt",
						},
						morphemes: [
							{
								kind: "Prefix",
								separability: "Separable",
								surface: "ab",
							},
							{
								kind: "Root",
								lemma: "Fahrt",
								surface: "fahrt",
							},
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section?.content).toContain("Abgeleitet von:");
		expect(result.section?.content).toContain("[[Fahrt]]");
		expect(result.section?.content).not.toContain(" = [[Abfahrt]]");
		expect(result.morphology?.prefixEquation).toBeUndefined();
	});

	it("keeps explicit derived_from even when prefix equation is present", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				features: {
					status: "ready",
					value: {
						conjugation: "Regular",
						kind: "verb",
						valency: {
							reflexivity: "NonReflexive",
							separability: "Separable",
						},
					},
				},
				lemma: {
					lemma: "aufpassen",
					linguisticUnit: "Lexem",
					posLikeKind: "Verb",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						derivedFrom: {
							derivationType: "prefix_derivation",
							lemma: "abpassen",
						},
						morphemes: [
							{
								kind: "Prefix",
								separability: "Separable",
								surface: "auf",
							},
							{
								kind: "Root",
								lemma: "passen",
								surface: "pass",
							},
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section?.content).toContain("Abgeleitet von:");
		expect(result.section?.content).toContain("[[abpassen]]");
		expect(result.section?.content).toContain(
			"[[auf-prefix-de|>auf]] + [[passen]] = [[aufpassen]]",
		);
		expect(result.morphology?.derivedFromLemma).toBe("abpassen");
		expect(result.morphology?.prefixEquation?.baseLemma).toBe("passen");
	});

	it("normalizes compounded lemma casing using morpheme lemmas", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				lemma: {
					lemma: "Fahrkarte",
					linguisticUnit: "Lexem",
					posLikeKind: "Noun",
					surfaceKind: "Lemma",
				},
				morphemicBreakdown: {
					status: "ready",
					value: {
						compoundedFrom: ["Fahren", "Karte"],
						morphemes: [
							{
								kind: "Root",
								lemma: "fahren",
								surface: "fahr",
							},
							{
								kind: "Root",
								lemma: "Karte",
								surface: "karte",
							},
						],
					},
				},
			}),
			targetLang: "German",
		});

		expect(result.section?.content).toContain("Besteht aus:");
		expect(result.section?.content).toContain("[[fahren]] + [[Karte]]");
		expect(result.morphology?.compoundedFromLemmas).toEqual([
			"fahren",
			"Karte",
		]);
	});
});
