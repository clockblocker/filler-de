import { describe, expect, it } from "bun:test";
import {
	type KnownSelection,
	type Lemma,
	LingIdCodec,
	lingOperation,
	type UnresolvedSurface,
} from "../../../src";
import {
	englishGiveUpTypoPartialGvaeSelection,
	englishGiveUpTypoPartialUpSelection,
	englishWalkLemma,
	englishWalkResolvedInflectionSurface,
	englishWalkStandardFullSelection,
	englishWalkUnresolvedInflectionSurface,
	germanMasculineSeeLemma,
} from "../../helpers";

describe("LingIdCodec", () => {
	it("encodes and decodes each concrete entity kind", () => {
		const lemma = englishWalkLemma;
		const resolvedSurface = englishWalkResolvedInflectionSurface;
		const unresolvedSurface = englishWalkUnresolvedInflectionSurface;
		const selection = englishWalkStandardFullSelection;

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
		const germanLemmaId = LingIdCodec.German.makeLingIdFor(
			germanMasculineSeeLemma satisfies Lemma<"German", "Lexeme", "NOUN">,
		);
		const mismatch = LingIdCodec.English.tryToDecode(germanLemmaId);

		expect(malformed.isErr()).toBe(true);
		expect(malformed._unsafeUnwrapErr().code).toBe("MalformedLingId");
		expect(mismatch.isErr()).toBe(true);
		expect(mismatch._unsafeUnwrapErr().code).toBe("LanguageMismatch");
	});

	it("returns entity mismatch for kind-specific decode requests", () => {
		const resolvedId = LingIdCodec.English.makeLingIdFor(
			englishWalkResolvedInflectionSurface,
		);

		const mismatch = LingIdCodec.English.tryToDecodeAs("Lemma", resolvedId);

		expect(mismatch.isErr()).toBe(true);
		expect(mismatch._unsafeUnwrapErr().code).toBe("EntityMismatch");
	});

	it("serializes feature bags canonically", () => {
		const left = {
			...englishWalkUnresolvedInflectionSurface,
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
			...englishWalkUnresolvedInflectionSurface,
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
		const upSelection = englishGiveUpTypoPartialUpSelection;
		const gvaeSelection = englishGiveUpTypoPartialGvaeSelection;

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

	it("keeps canonical and variant selections distinct in Ling IDs", () => {
		const canonicalSelection = englishWalkStandardFullSelection;
		const variantSelection = {
			...englishWalkStandardFullSelection,
			spelledSelection: "walk",
			spellingRelation: "Variant" as const,
		};

		const canonicalId =
			LingIdCodec.English.makeLingIdFor(canonicalSelection);
		const variantId = LingIdCodec.English.makeLingIdFor(variantSelection);

		expect(canonicalId).not.toBe(variantId);
		expect(
			LingIdCodec.English.tryToDecodeAs(
				"Selection",
				variantId,
			)._unsafeUnwrap().spellingRelation,
		).toBe("Variant");
	});
});
