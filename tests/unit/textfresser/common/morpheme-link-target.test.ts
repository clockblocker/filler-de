import { describe, expect, it } from "bun:test";
import { resolveMorphemeItems } from "../../../../src/commanders/textfresser/common/morpheme-link-target";
import type { LlmMorpheme } from "../../../../src/prompt-smith/schemas/morphem";

describe("resolveMorphemeItems", () => {
	it("does not duplicate prefix suffix when surf already contains -prefix-de", () => {
		const morphemes: LlmMorpheme[] = [
			{
				kind: "Prefix",
				separability: "Separable",
				surf: "Worter/de/prefix/auf-prefix-de",
			},
		];

		const [prefix] = resolveMorphemeItems(morphemes, "German");
		expect(prefix?.surf).toBe("auf");
		expect(prefix?.linkTarget).toBe("auf-prefix-de");
	});

	it("builds canonical prefix target from plain prefix surface", () => {
		const morphemes: LlmMorpheme[] = [
			{
				kind: "Prefix",
				separability: "Inseparable",
				surf: "ver",
			},
		];

		const [prefix] = resolveMorphemeItems(morphemes, "German");
		expect(prefix?.surf).toBe("ver");
		expect(prefix?.linkTarget).toBe("ver-prefix-de");
	});

	it("strips anchors from morpheme surf/lemma tokens", () => {
		const morphemes: LlmMorpheme[] = [
			{
				kind: "Root",
				lemma: "fahren#^lemma",
				surf: "fährt#^surface",
			},
		];

		const [root] = resolveMorphemeItems(morphemes, "German");
		expect(root?.surf).toBe("fährt");
		expect(root?.lemma).toBe("fahren");
	});
});
