import { describe, expect, it } from "bun:test";
import {
	type KnownSelection,
	type Lemma,
	LingIdCodec,
	lingOperation,
	type ResolvedSurface,
	type Selection,
	type UnresolvedSurface,
} from "../../../src";

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

function buildEnglishGiveUpTypoSurface() {
	return {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Past",
			verbForm: "Fin",
		},
		language: "English",
		normalizedFullSurface: "gave up",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "give up",
		},
	} satisfies UnresolvedSurface<
		"English",
		"Typo",
		"Inflection",
		"Lexeme",
		"VERB"
	>;
}

function buildEnglishGiveUpTypoSelection(spelledSelection: "gvae" | "up") {
	return {
		language: "English",
		orthographicStatus: "Typo",
		selectionCoverage: "Partial",
		spelledSelection,
		surface: buildEnglishGiveUpTypoSurface(),
	} satisfies Selection<
		"English",
		"Typo",
		"Inflection",
		"Lexeme",
		"VERB"
	>;
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

		expect(lemmaId.startsWith("ling:v1:EN:LEM;")).toBe(true);
		expect(resolvedId.startsWith("ling:v1:EN:SURF-RES;")).toBe(true);
		expect(unresolvedId.startsWith("ling:v1:EN:SURF-UNRES;")).toBe(true);
		expect(selectionId.startsWith("ling:v1:EN:SEL;")).toBe(true);

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

	it("keeps partial typo selections distinct while preserving shared surface identity", () => {
		const upSelection = buildEnglishGiveUpTypoSelection("up");
		const gvaeSelection = buildEnglishGiveUpTypoSelection("gvae");

		const upSelectionId = LingIdCodec.English.makeLingIdFor(upSelection);
		const gvaeSelectionId =
			LingIdCodec.English.makeLingIdFor(gvaeSelection);

		expect(upSelectionId).not.toBe(gvaeSelectionId);

		const upSurface =
			lingOperation.extract.surface.fromSelection(upSelection);
		const gvaeSurface =
			lingOperation.extract.surface.fromSelection(gvaeSelection);

		expect(LingIdCodec.English.makeLingIdFor(upSurface)).toBe(
			LingIdCodec.English.makeLingIdFor(gvaeSurface),
		);
	});
});
