import { describe, expect, it } from "bun:test";
import type { AnyLemma, AnySelection } from "../src";
import { toLingId } from "../src";

describe("LingId", () => {
	it("matches lemma ids with structurally consistent standard lemma selections", () => {
		const lemma: AnyLemma<"German"> = {
			emojiDescription: ["🏰", "👑"],
			inherentFeatures: { gender: "Fem" },
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: " Burg ",
		};
		const selection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					emojiDescription: ["👑", "🏰", "🏰"],
					inherentFeatures: { gender: "Fem" },
					lemmaKind: "Lexeme",
					language: "German",
					pos: "NOUN",
					spelledLemma: "Burg",
				},
				spelledSurface: "Burg",
				surfaceKind: "Lemma",
			},
		};

		expect(toLingId(lemma)).toBe(toLingId(selection));
	});

	it("preserves the actual surface kind instead of normalizing to lemma identity", () => {
		const lemmaSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					inherentFeatures: { separable: true },
					lemmaKind: "Lexeme",
					language: "German",
					pos: "VERB",
					spelledLemma: "aufgehen",
				},
				spelledSurface: "aufgehen",
				surfaceKind: "Lemma",
			},
		};
		const partialSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					inherentFeatures: { separable: true },
					lemmaKind: "Lexeme",
					language: "German",
					pos: "VERB",
					spelledLemma: "aufgehen",
				},
				spelledSurface: "gehen",
				surfaceKind: "Partial",
			},
		};

		expect(toLingId(lemmaSelection)).not.toBe(toLingId(partialSelection));
	});

	it("returns null for unknown selections, empty normalized surfaces, and inconsistent standard lemma selections", () => {
		const unknownSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Unknown",
		};
		const emptyLemma = {
			emojiDescription: [],
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: " \n\t ",
		} as AnyLemma<"German">;
		const inconsistentSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					lemmaKind: "Lexeme",
					language: "German",
					pos: "NOUN",
					spelledLemma: "Hund",
				},
				spelledSurface: "Katze",
				surfaceKind: "Lemma",
			},
		};

		expect(toLingId(unknownSelection)).toBeNull();
		expect(toLingId(emptyLemma)).toBeNull();
		expect(toLingId(inconsistentSelection)).toBeNull();
	});

	it("uses typo surfaces as written", () => {
		const standardSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					inherentFeatures: { gender: "Masc" },
					lemmaKind: "Lexeme",
					language: "German",
					pos: "NOUN",
					spelledLemma: "Hund",
				},
				spelledSurface: "Hund",
				surfaceKind: "Lemma",
			},
		};
		const typoSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Typo",
			surface: {
				lemma: {
					inherentFeatures: { gender: "Masc" },
					lemmaKind: "Lexeme",
					language: "German",
					pos: "NOUN",
					spelledLemma: "Hund",
				},
				spelledSurface: "Hnud",
				surfaceKind: "Lemma",
			},
		};

		expect(toLingId(standardSelection)).not.toBe(toLingId(typoSelection));
	});

	it("treats emoji descriptions as an unordered set", () => {
		const left: AnyLemma<"German"> = {
			emojiDescription: ["🏰", "👑"],
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: "Burg",
		};
		const right: AnyLemma<"German"> = {
			emojiDescription: ["👑", "🏰", "🏰"],
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: "Burg",
		};

		expect(toLingId(left)).toBe(toLingId(right));
	});

	it("applies the initial identity-feature policy for German noun, verb, and prefix morpheme bundles", () => {
		const feminineNoun: AnyLemma<"German"> = {
			inherentFeatures: { gender: "Fem" },
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: "Burg",
		};
		const neuterNoun: AnyLemma<"German"> = {
			inherentFeatures: { gender: "Neut" },
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: "Burg",
		};
		const separableVerb: AnyLemma<"German"> = {
			inherentFeatures: { separable: true },
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "VERB",
			spelledLemma: "aufgehen",
		};
		const inseparableVerb: AnyLemma<"German"> = {
			inherentFeatures: { separable: false },
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "VERB",
			spelledLemma: "aufgehen",
		};
		const separablePrefix: AnyLemma<"German"> = {
			language: "German",
			lemmaKind: "Morpheme",
			lexicalRelations: {},
			morphemeKind: "Prefix",
			separable: true,
			spelledLemma: "ab-",
		};
		const inseparablePrefix: AnyLemma<"German"> = {
			language: "German",
			lemmaKind: "Morpheme",
			lexicalRelations: {},
			morphemeKind: "Prefix",
			separable: false,
			spelledLemma: "ab-",
		};

		expect(toLingId(feminineNoun)).not.toBe(toLingId(neuterNoun));
		expect(toLingId(separableVerb)).not.toBe(toLingId(inseparableVerb));
		expect(toLingId(separablePrefix)).not.toBe(toLingId(inseparablePrefix));
	});

	it("returns null when a declared identity feature is missing", () => {
		const nounWithoutGender: AnyLemma<"German"> = {
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: "Burg",
		};
		const verbWithoutSeparable: AnyLemma<"German"> = {
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "VERB",
			spelledLemma: "aufgehen",
		};
		const prefixWithoutSeparable: AnyLemma<"German"> = {
			language: "German",
			lemmaKind: "Morpheme",
			lexicalRelations: {},
			morphemeKind: "Prefix",
			spelledLemma: "ab-",
		};

		expect(toLingId(nounWithoutGender)).toBeNull();
		expect(toLingId(verbWithoutSeparable)).toBeNull();
		expect(toLingId(prefixWithoutSeparable)).toBeNull();
	});

	it("excludes discourseFormulaRole from v1 identity semantics", () => {
		const left: AnyLemma<"German"> = {
			discourseFormulaRole: "Greeting",
			language: "German",
			lemmaKind: "Phraseme",
			lexicalRelations: {},
			phrasemeKind: "DiscourseFormula",
			spelledLemma: "na klar",
		};
		const right: AnyLemma<"German"> = {
			discourseFormulaRole: "Reaction",
			language: "German",
			lemmaKind: "Phraseme",
			lexicalRelations: {},
			phrasemeKind: "DiscourseFormula",
			spelledLemma: "na klar",
		};

		expect(toLingId(left)).toBe(toLingId(right));
	});

	it("returns null when runtime language or spelled lemma is absent", () => {
		const missingLanguage = {
			inherentFeatures: {},
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
			spelledLemma: "Burg",
		} as AnyLemma<"German">;
		const missingSpelledLemma = {
			inherentFeatures: {},
			language: "German",
			lemmaKind: "Lexeme",
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
		} as AnyLemma<"German">;

		expect(toLingId(missingLanguage)).toBeNull();
		expect(toLingId(missingSpelledLemma)).toBeNull();
	});
});
