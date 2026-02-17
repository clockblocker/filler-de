import { describe, expect, it } from "bun:test";
import { generateMorphologySection } from "../../../../src/commanders/textfresser/commands/generate/steps/section-generators/morphology-section-generator";
import type { MorphemeItem } from "../../../../src/commanders/textfresser/domain/morpheme/morpheme-formatter";

describe("generateMorphologySection", () => {
	it("renders derived-only block", () => {
		const result = generateMorphologySection({
			morphemes: [{ kind: "Root", lemma: "frei", surf: "frei" }],
			output: {
				derived_from: {
					derivation_type: "suffix_derivation",
					lemma: "frei",
				},
				morphemes: [{ kind: "Root", lemma: "frei", surf: "frei" }],
			},
			sourceLemma: "Freiheit",
			targetLang: "German",
		});

		expect(result.section?.content).toContain("<derived_from>");
		expect(result.section?.content).toContain("[[frei]]");
		expect(result.section?.content).not.toContain("<consists_of>");
	});

	it("renders compound-only block", () => {
		const result = generateMorphologySection({
			morphemes: [
				{ kind: "Root", lemma: "Küche", surf: "küche" },
				{ kind: "Interfix", surf: "n" },
				{ kind: "Root", lemma: "Fenster", surf: "fenster" },
			],
			output: {
				compounded_from: ["Küche", "Fenster"],
				morphemes: [
					{ kind: "Root", lemma: "Küche", surf: "küche" },
					{ kind: "Interfix", surf: "n" },
					{ kind: "Root", lemma: "Fenster", surf: "fenster" },
				],
			},
			sourceLemma: "Küchenfenster",
			targetLang: "German",
		});

		expect(result.section?.content).toContain("<consists_of>");
		expect(result.section?.content).toContain("[[Küche]] + [[Fenster]]");
		expect(result.section?.content).not.toContain("<derived_from>");
	});

	it("renders mixed output with prefix equation and gloss", () => {
		const morphemes: MorphemeItem[] = [
			{
				kind: "Prefix",
				linkTarget: "auf-prefix-de",
				separability: "Separable",
				surf: "auf",
			},
			{ kind: "Root", lemma: "passen", surf: "passen" },
		];

		const result = generateMorphologySection({
			morphemes,
			output: {
				compounded_from: ["A", "B"],
				morphemes: [
					{ kind: "Prefix", separability: "Separable", surf: "auf" },
					{ kind: "Root", lemma: "passen", surf: "passen" },
				],
			},
			sourceLemma: "aufpassen",
			sourceTranslation: "to pay attention",
			targetLang: "German",
		});

		expect(result.section?.content).not.toContain("<derived_from>");
		expect(result.section?.content).toContain("<consists_of>");
		expect(result.section?.content).toContain(
			"[[auf-prefix-de|>auf]] + [[passen]] = [[aufpassen]] *(to pay attention)*",
		);
	});

	it("renders inseparable prefix marker in equation", () => {
		const result = generateMorphologySection({
			morphemes: [
				{
					kind: "Prefix",
					linkTarget: "ver-prefix-de",
					separability: "Inseparable",
					surf: "ver",
				},
				{ kind: "Root", lemma: "stehen", surf: "stehen" },
			],
			output: {
				morphemes: [
					{ kind: "Prefix", separability: "Inseparable", surf: "ver" },
					{ kind: "Root", lemma: "stehen", surf: "stehen" },
				],
			},
			sourceLemma: "verstehen",
			targetLang: "German",
		});

		expect(result.section?.content).toContain(
			"[[ver-prefix-de|ver<]] + [[stehen]] = [[verstehen]]",
		);
		expect(result.section?.content).not.toContain("<derived_from>");
	});

	it("does not build prefix equation for non-verb prefix without separability", () => {
		const result = generateMorphologySection({
			morphemes: [
				{ kind: "Prefix", surf: "un" },
				{ kind: "Root", lemma: "klar", surf: "klar" },
			],
			output: {
				derived_from: {
					derivation_type: "prefix_derivation",
					lemma: "klar",
				},
				morphemes: [
					{ kind: "Prefix", surf: "un" },
					{ kind: "Root", lemma: "klar", surf: "klar" },
				],
			},
			sourceLemma: "unklar",
			targetLang: "German",
		});

		expect(result.section?.content).toContain("<derived_from>");
		expect(result.section?.content).toContain("[[klar]]");
		expect(result.section?.content).not.toContain(" = [[unklar]]");
	});

	it("omits section when no morphology fields are available", () => {
		const result = generateMorphologySection({
			morphemes: [{ kind: "Root", lemma: "Xenon", surf: "xenon" }],
			output: {
				morphemes: [{ kind: "Root", lemma: "Xenon", surf: "xenon" }],
			},
			sourceLemma: "Xenon",
			targetLang: "German",
		});

		expect(result.section).toBeNull();
		expect(result.morphology).toBeUndefined();
	});
});
