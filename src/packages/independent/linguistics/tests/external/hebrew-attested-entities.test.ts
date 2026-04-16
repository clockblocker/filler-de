import { describe, expect, it } from "bun:test";
import { LingIdCodec, lingOperation, lingSchemaFor } from "../../src";
import {
	hebrewKatavLemma,
	hebrewKatvuResolvedInflectionSurface,
	hebrewKatvuStandardFullSelection,
	hebrewKatvuUnresolvedInflectionSurface,
	hebrewShanaLemma,
	hebrewShanaResolvedLemmaSelection,
	hebrewShanaResolvedLemmaSurface,
} from "../helpers";

describe("Hebrew attested entities", () => {
	it("stay valid against the public Hebrew schemas", () => {
		expect(
			lingSchemaFor.Lemma.Hebrew.Lexeme.VERB.safeParse(hebrewKatavLemma)
				.success,
		).toBe(true);
		expect(
			lingSchemaFor.Lemma.Hebrew.Lexeme.NOUN.safeParse(hebrewShanaLemma)
				.success,
		).toBe(true);
		expect(
			lingSchemaFor.ResolvedSurface.Hebrew.Standard.Inflection.Lexeme.VERB.safeParse(
				hebrewKatvuResolvedInflectionSurface,
			).success,
		).toBe(true);
		expect(
			lingSchemaFor.ResolvedSurface.Hebrew.Standard.Lemma.Lexeme.NOUN.safeParse(
				hebrewShanaResolvedLemmaSurface,
			).success,
		).toBe(true);
		expect(
			lingSchemaFor.Selection.Hebrew.Standard.Inflection.Lexeme.VERB.safeParse(
				hebrewKatvuStandardFullSelection,
			).success,
		).toBe(true);
		expect(
			lingSchemaFor.Selection.Hebrew.Standard.Lemma.Lexeme.NOUN.safeParse(
				hebrewShanaResolvedLemmaSelection,
			).success,
		).toBe(true);
	});

	it("work with the public operation helpers", () => {
		expect(
			lingOperation.resolve.unresolvedSurface.withLemma(
				hebrewKatvuUnresolvedInflectionSurface,
				hebrewKatavLemma,
			),
		).toEqual(hebrewKatvuResolvedInflectionSurface);
		expect(
			lingOperation.unresolve.surface(hebrewKatvuResolvedInflectionSurface),
		).toEqual(hebrewKatvuUnresolvedInflectionSurface);
		expect(
			lingOperation.extract.surface.fromSelection(
				hebrewShanaResolvedLemmaSelection,
			),
		).toBe(hebrewShanaResolvedLemmaSurface);
		expect(
			lingOperation.extract.lemma.fromSurface(
				hebrewShanaResolvedLemmaSurface,
			),
		).toBe(hebrewShanaLemma);
	});

	it("round-trip through the Hebrew Ling ID codec", () => {
		const lemmaId = LingIdCodec.Hebrew.makeLingIdFor(hebrewKatavLemma);
		const resolvedSurfaceId = LingIdCodec.Hebrew.makeLingIdFor(
			hebrewKatvuResolvedInflectionSurface,
		);
		const unresolvedSurfaceId = LingIdCodec.Hebrew.makeLingIdFor(
			hebrewKatvuUnresolvedInflectionSurface,
		);
		const selectionId = LingIdCodec.Hebrew.makeLingIdFor(
			hebrewKatvuStandardFullSelection,
		);

		expect(
			LingIdCodec.Hebrew.tryToDecodeAs("Lemma", lemmaId)._unsafeUnwrap(),
		).toEqual(hebrewKatavLemma);
		expect(
			LingIdCodec.Hebrew.tryToDecodeAs(
				"ResolvedSurface",
				resolvedSurfaceId,
			)._unsafeUnwrap(),
		).toEqual(hebrewKatvuResolvedInflectionSurface);
		expect(
			LingIdCodec.Hebrew.tryToDecodeAs(
				"UnresolvedSurface",
				unresolvedSurfaceId,
			)._unsafeUnwrap(),
		).toEqual(hebrewKatvuUnresolvedInflectionSurface);
		expect(
			LingIdCodec.Hebrew.tryToDecodeAs("Selection", selectionId)._unsafeUnwrap(),
		).toEqual(hebrewKatvuStandardFullSelection);
	});
});
