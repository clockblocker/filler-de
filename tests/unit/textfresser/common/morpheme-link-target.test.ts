import { describe, expect, it } from "bun:test";
import { resolveMorphemeItems } from "../../../../src/commanders/textfresser/common/morpheme-link-target";
import type { LexicalMorpheme } from "../../../../src/lexical-generation";

describe("resolveMorphemeItems", () => {
	it("does not duplicate prefix suffix when surf already contains -prefix-de", () => {
		const morphemes: LexicalMorpheme[] = [
			{
				kind: "Prefix",
				separability: "Separable",
				surface: "Worter/de/prefix/auf-prefix-de",
			},
		];

		const [prefix] = resolveMorphemeItems(morphemes, "German");
		expect(prefix?.surf).toBe("auf");
		expect(prefix?.linkTarget).toBe("auf-prefix-de");
	});

	it("builds canonical prefix target from plain prefix surface", () => {
		const morphemes: LexicalMorpheme[] = [
			{
				kind: "Prefix",
				separability: "Inseparable",
				surface: "ver",
			},
		];

		const [prefix] = resolveMorphemeItems(morphemes, "German");
		expect(prefix?.surf).toBe("ver");
		expect(prefix?.linkTarget).toBe("ver-prefix-de");
	});

	it("strips anchors from morpheme surf/lemma tokens", () => {
		const morphemes: LexicalMorpheme[] = [
			{
				kind: "Root",
				lemma: "fahren#^lemma",
				surface: "fährt#^surface",
			},
		];

		const [root] = resolveMorphemeItems(morphemes, "German");
		expect(root?.surf).toBe("fährt");
		expect(root?.lemma).toBe("fahren");
	});
});
