import { describe, expect, it } from "bun:test";
import {
	type Lemma,
	LingOperation,
	lingSchemaFor,
	type Selection,
	type Surface,
} from "../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
} from "./ling-id/ling-id-test-helpers";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
	? 1
	: 2
	? true
	: false;

type Assert<T extends true> = T;

declare const englishUnknownSelection: Selection<"English", "Unknown">;
declare const englishWalkLemmaForTypes: Lemma<"English", "Lexeme", "VERB">;
type ExpectedResolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme";
		lemmaSubKind: "VERB";
	};
	language: "English";
	normalizedFullSurface: string;
	surfaceKind: "Lemma";
	target: Lemma<"English", "Lexeme", "VERB">;
};

if (false) {
	const extractedUnknownSurface =
		LingOperation.extract.surface.fromSelection(englishUnknownSelection);
	const _unknownSelectionExtractsNull: Assert<
		Equal<typeof extractedUnknownSurface, null>
	> = true;

	const resolvedLemmaSurfaceFromType =
		LingOperation.convert.lemma.toResolvedLemmaSurface(
			englishWalkLemmaForTypes,
		);
	const _resolvedLemmaSurfaceStaysPrecise: Assert<
		Equal<typeof resolvedLemmaSurfaceFromType, ExpectedResolvedLemmaSurface>
	> = true;

	void _unknownSelectionExtractsNull;
	void _resolvedLemmaSurfaceStaysPrecise;
}

describe("LingOperation", () => {
	it("extracts null from unknown selections", () => {
		const unknownSelection = {
			language: "English",
			orthographicStatus: "Unknown",
			spelledSelection: "walq",
		} satisfies Selection<"English", "Unknown">;

		expect(LingOperation.extract.surface.fromSelection(unknownSelection)).toBe(
			null,
		);
	});

	it("extracts the exact surface from known selections", () => {
		const lemma = buildEnglishWalkLemma();
		const selection = {
			language: "English",
			orthographicStatus: "Standard",
			selectionCoverage: "Full",
			spelledSelection: "walk",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				language: "English",
				normalizedFullSurface: "walk",
				surfaceKind: "Lemma",
				target: lemma,
			},
		} satisfies Selection<"English", "Standard", "Lemma", "Lexeme", "VERB">;

		expect(LingOperation.extract.surface.fromSelection(selection)).toBe(
			selection.surface,
		);
	});

	it("extracts hydrated lemmas from resolved surfaces and null from unresolved ones", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface =
			LingOperation.convert.lemma.toResolvedLemmaSurface(lemma);
		const unresolvedSurface = {
			...resolvedSurface,
			target: {
				canonicalLemma: lemma.canonicalLemma,
			},
		} satisfies Surface<"English", "Standard", "Lemma", "Lexeme", "VERB">;

		expect(LingOperation.extract.lemma.fromSurface(resolvedSurface)).toBe(
			lemma,
		);
		expect(LingOperation.extract.lemma.fromSurface(unresolvedSurface)).toBe(
			null,
		);
	});

	it("builds valid resolved lemma surfaces", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface =
			LingOperation.convert.lemma.toResolvedLemmaSurface(lemma);

		expect(resolvedSurface).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			language: "English",
			normalizedFullSurface: "walk",
			surfaceKind: "Lemma",
			target: lemma,
		});
		expect(
			lingSchemaFor.ResolvedSurface.English.Standard.Lemma.Lexeme.VERB.safeParse(
				resolvedSurface,
			).success,
		).toBe(true);
	});

	it("wraps surfaces into valid standard full selections and honors overrides", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface =
			LingOperation.convert.lemma.toResolvedLemmaSurface(lemma);

		const selection =
			LingOperation.convert.surface.toStandardFullSelection(
				resolvedSurface,
				{
					spelledSelection: "Walk",
				},
			);

		expect(selection).toEqual({
			language: "English",
			orthographicStatus: "Standard",
			selectionCoverage: "Full",
			spelledSelection: "Walk",
			surface: resolvedSurface,
		});
		expect(
			lingSchemaFor.Selection.English.Standard.Lemma.Lexeme.VERB.safeParse(
				selection,
			).success,
		).toBe(true);
	});

	it("composes lemma conversion through the lower-level helpers", () => {
		const lemma = buildEnglishWalkLemma();

		expect(
			LingOperation.convert.lemma.toStandardFullSelection(lemma, {
				spelledSelection: "Walk",
			}),
		).toEqual(
			LingOperation.convert.surface.toStandardFullSelection(
				LingOperation.convert.lemma.toResolvedLemmaSurface(lemma),
				{
					spelledSelection: "Walk",
				},
			),
		);
	});

	it("enforces bound language matching at runtime", () => {
		const germanOps = LingOperation.forLanguage("German");

		expect(() =>
			germanOps.convert.lemma.toResolvedLemmaSurface(
				buildEnglishWalkLemma() as unknown as Lemma<"German">,
			),
		).toThrow(
			"LingOperation language mismatch: expected German, received English",
		);
		expect(() =>
			germanOps.convert.surface.toStandardFullSelection(
				LingOperation.convert.lemma.toResolvedLemmaSurface(
					buildEnglishWalkLemma(),
				) as unknown as Surface<"German">,
			),
		).toThrow(
			"LingOperation language mismatch: expected German, received English",
		);
	});

	it("returns language-bound results with the same structural behavior", () => {
		const germanLemma = buildGermanFeminineSeeLemma();
		const germanOps = LingOperation.forLanguage("German");

		expect(germanOps.convert.lemma.toResolvedLemmaSurface(germanLemma)).toEqual(
			{
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				language: "German",
				normalizedFullSurface: "See",
				surfaceKind: "Lemma",
				target: germanLemma,
			},
		);
	});
});
