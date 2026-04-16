import { describe, expect, it } from "bun:test";
import {
	type Lemma,
	LingIdCodec,
	lingOperation,
	type ResolvedSurface,
	type UnresolvedSurface,
} from "../../../src";
import type { KnownSelection } from "../../../src/ling-id/types";

function buildEnglishWalkLemma() {
	return {
		canonicalLemma: "walk",
		inherentFeatures: {},
		language: "English",
		lemmaKind: "Lexeme",
		meaningInEmojis: "🚶",
		pos: "VERB",
	} satisfies Lemma<"English", "Lexeme", "VERB">;
}

function buildEnglishResolvedInflectionSurface() {
	return {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Pres",
			verbForm: "Fin",
		},
		language: "English",
		normalizedFullSurface: "walk",
		surfaceKind: "Inflection",
		target: buildEnglishWalkLemma(),
	} satisfies ResolvedSurface<
		"English",
		"Standard",
		"Inflection",
		"Lexeme",
		"VERB"
	>;
}

function buildEnglishUnresolvedInflectionSurface() {
	return {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Pres",
			verbForm: "Fin",
		},
		language: "English",
		normalizedFullSurface: "walk",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "walk",
		},
	} satisfies UnresolvedSurface<
		"English",
		"Standard",
		"Inflection",
		"Lexeme",
		"VERB"
	>;
}

function buildEnglishSelection(
	surface = buildEnglishUnresolvedInflectionSurface(),
) {
	return lingOperation
		.forLanguage("English")
		.convert.surface.toStandardFullSelection(surface, {
			spelledSelection: "walk",
		}) satisfies KnownSelection<"English">;
}

describe("LingIdCodec", () => {
	it("encodes and decodes each concrete entity kind", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface = buildEnglishResolvedInflectionSurface();
		const unresolvedSurface = buildEnglishUnresolvedInflectionSurface();
		const selection = buildEnglishSelection();

		const lemmaId = LingIdCodec.English.makeLingIdFor(lemma);
		const resolvedId = LingIdCodec.English.makeLingIdFor(resolvedSurface);
		const unresolvedId =
			LingIdCodec.English.makeLingIdFor(unresolvedSurface);
		const selectionId = LingIdCodec.English.makeLingIdFor(selection);

		expect(lemmaId.startsWith("ling:v2:EN:LEM;")).toBe(true);
		expect(resolvedId.startsWith("ling:v2:EN:SURF-RES;")).toBe(true);
		expect(unresolvedId.startsWith("ling:v2:EN:SURF-UNRES;")).toBe(true);
		expect(selectionId.startsWith("ling:v2:EN:SEL;")).toBe(true);

		const decodedLemma = LingIdCodec.English.tryToDecodeAs(
			"Lemma",
			lemmaId,
		);
		const decodedResolved = LingIdCodec.English.tryToDecodeAs(
			"ResolvedSurface",
			resolvedId,
		);
		const decodedUnresolved = LingIdCodec.English.tryToDecodeAs(
			"UnresolvedSurface",
			unresolvedId,
		);
		const decodedSelection = LingIdCodec.English.tryToDecodeAs(
			"Selection",
			selectionId,
		);

		expect(decodedLemma.isOk()).toBe(true);
		expect(decodedResolved.isOk()).toBe(true);
		expect(decodedUnresolved.isOk()).toBe(true);
		expect(decodedSelection.isOk()).toBe(true);
		expect(decodedLemma._unsafeUnwrap()).toEqual(lemma);
		expect(decodedResolved._unsafeUnwrap()).toEqual(resolvedSurface);
		expect(decodedUnresolved._unsafeUnwrap()).toEqual(unresolvedSurface);
		expect(decodedSelection._unsafeUnwrap()).toEqual(selection);
		expect(decodedSelection._unsafeUnwrap().orthographicStatus).not.toBe(
			"Unknown",
		);
	});

	it("rejects unknown selections at runtime", () => {
		const unknownSelection = {
			language: "English",
			orthographicStatus: "Unknown",
			spelledSelection: "wlk",
		};

		expect(() =>
			LingIdCodec.English.makeLingIdFor(
				unknownSelection as unknown as KnownSelection<"English">,
			),
		).toThrow("Unknown selections cannot be encoded as Ling IDs");
	});

	it("returns structured errors for malformed ids and language mismatch", () => {
		const malformed = LingIdCodec.English.tryToDecode("not-a-ling-id");
		const germanLemmaId = LingIdCodec.German.makeLingIdFor({
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">);
		const mismatch = LingIdCodec.English.tryToDecode(germanLemmaId);

		expect(malformed.isErr()).toBe(true);
		expect(malformed._unsafeUnwrapErr().code).toBe("MalformedLingId");
		expect(mismatch.isErr()).toBe(true);
		expect(mismatch._unsafeUnwrapErr().code).toBe("LanguageMismatch");
	});

	it("returns entity mismatch for kind-specific decode requests", () => {
		const resolvedId = LingIdCodec.English.makeLingIdFor(
			buildEnglishResolvedInflectionSurface(),
		);

		const mismatch = LingIdCodec.English.tryToDecodeAs("Lemma", resolvedId);

		expect(mismatch.isErr()).toBe(true);
		expect(mismatch._unsafeUnwrapErr().code).toBe("EntityMismatch");
	});

	it("serializes feature bags canonically", () => {
		const left = {
			...buildEnglishUnresolvedInflectionSurface(),
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
		} satisfies UnresolvedSurface<
			"English",
			"Standard",
			"Inflection",
			"Lexeme",
			"VERB"
		>;
		const right = {
			...buildEnglishUnresolvedInflectionSurface(),
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
		} satisfies UnresolvedSurface<
			"English",
			"Standard",
			"Inflection",
			"Lexeme",
			"VERB"
		>;

		expect(LingIdCodec.English.makeLingIdFor(left)).toBe(
			LingIdCodec.English.makeLingIdFor(right),
		);
	});
});
