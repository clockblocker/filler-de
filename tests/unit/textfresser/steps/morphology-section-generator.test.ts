import { describe, expect, it } from "bun:test";
import { generateMorphologySection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/morphology-section-generator";
import {
	makeLexemeLexicalInfo,
	makeMorphemicBreakdown,
} from "../helpers/native-fixtures";

function makeLexicalInfo(params: {
	features?: ReturnType<typeof makeLexemeLexicalInfo>["features"];
	lemma?: string;
	morphemicBreakdown?: ReturnType<typeof makeLexemeLexicalInfo>["morphemicBreakdown"];
	pos?: "ADJ" | "NOUN" | "VERB";
} = {}) {
	return makeLexemeLexicalInfo({
		features:
			params.features ??
			({
				status: "ready",
				value: {
					inherentFeatures: {
						gender: "Fem",
					},
				},
			} as const),
		lemma: params.lemma ?? "Freiheit",
		morphemicBreakdown:
			params.morphemicBreakdown ??
			makeMorphemicBreakdown({
				morphemes: [{ kind: "Root", lemma: "frei", surface: "frei" }],
			}),
		pos: params.pos ?? "NOUN",
	});
}

describe("generateMorphologySection", () => {
	it("renders derived-only block", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				morphemicBreakdown: makeMorphemicBreakdown({
					derivedFrom: {
						derivationType: "suffix_derivation",
						lemma: "frei",
					},
					morphemes: [{ kind: "Root", lemma: "frei", surface: "frei" }],
				}),
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
				lemma: "Küchenfenster",
				morphemicBreakdown: makeMorphemicBreakdown({
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
				}),
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
						inherentFeatures: {
							reflex: false,
							separable: true,
						},
					},
				},
				lemma: "aufpassen",
				morphemicBreakdown: makeMorphemicBreakdown({
					compoundedFrom: ["A", "B"],
					morphemes: [
						{
							isSeparable: true,
							kind: "Prefix",
							surface: "auf",
						},
						{
							kind: "Root",
							lemma: "passen",
							surface: "passen",
						},
					],
				}),
				pos: "VERB",
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
						inherentFeatures: {
							reflex: false,
							separable: false,
						},
					},
				},
				lemma: "verstehen",
				morphemicBreakdown: makeMorphemicBreakdown({
					morphemes: [
						{
							isSeparable: false,
							kind: "Prefix",
							surface: "ver",
						},
						{
							kind: "Root",
							lemma: "stehen",
							surface: "stehen",
						},
					],
				}),
				pos: "VERB",
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
						inherentFeatures: {},
					},
				},
				lemma: "unklar",
				morphemicBreakdown: makeMorphemicBreakdown({
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
				}),
				pos: "ADJ",
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
				lemma: "Xenon",
				morphemicBreakdown: makeMorphemicBreakdown({
					morphemes: [
						{
							kind: "Root",
							lemma: "Xenon",
							surface: "xenon",
						},
					],
				}),
			}),
			targetLang: "German",
		});

		expect(result.section).toBeNull();
		expect(result.morphology).toBeUndefined();
	});

	it("does not build separable-prefix equation for nouns", () => {
		const result = generateMorphologySection({
			lexicalInfo: makeLexicalInfo({
				lemma: "Abfahrt",
				morphemicBreakdown: makeMorphemicBreakdown({
					derivedFrom: {
						derivationType: "prefix_derivation",
						lemma: "Fahrt",
					},
					morphemes: [
						{
							isSeparable: true,
							kind: "Prefix",
							surface: "ab",
						},
						{
							kind: "Root",
							lemma: "Fahrt",
							surface: "fahrt",
						},
					],
				}),
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
						inherentFeatures: {
							reflex: false,
							separable: true,
						},
					},
				},
				lemma: "aufpassen",
				morphemicBreakdown: makeMorphemicBreakdown({
					derivedFrom: {
						derivationType: "prefix_derivation",
						lemma: "abpassen",
					},
					morphemes: [
						{
							isSeparable: true,
							kind: "Prefix",
							surface: "auf",
						},
						{
							kind: "Root",
							lemma: "passen",
							surface: "pass",
						},
					],
				}),
				pos: "VERB",
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
				lemma: "Fahrkarte",
				morphemicBreakdown: makeMorphemicBreakdown({
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
				}),
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
