import { describe, expect, it } from "bun:test";
import {
	lingOperation,
	lingSchemaFor,
	type Selection,
	type Surface,
} from "../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
} from "./ling-id/ling-id-test-helpers";

describe("lingOperation", () => {
	it("extracts null from unknown selections", () => {
		const unknownSelection = {
			language: "English",
			orthographicStatus: "Unknown",
			spelledSelection: "walq",
		} satisfies Selection<"English", "Unknown">;

		expect(
			lingOperation.extract.surface.fromSelection(unknownSelection),
		).toBe(null);
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

		expect(lingOperation.extract.surface.fromSelection(selection)).toBe(
			selection.surface,
		);
	});

	it("extracts hydrated lemmas from resolved surfaces and null from unresolved ones", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface =
			lingOperation.convert.lemma.toResolvedLemmaSurface(lemma);
		const unresolvedSurface = {
			...resolvedSurface,
			target: {
				canonicalLemma: lemma.canonicalLemma,
			},
		} satisfies Surface<"English", "Standard", "Lemma", "Lexeme", "VERB">;

		expect(lingOperation.extract.lemma.fromSurface(resolvedSurface)).toBe(
			lemma,
		);
		expect(lingOperation.extract.lemma.fromSurface(unresolvedSurface)).toBe(
			null,
		);
	});

	it("builds valid resolved lemma surfaces", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface =
			lingOperation.convert.lemma.toResolvedLemmaSurface(lemma);

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

	it("resolves unresolved surfaces with matching lemmas", () => {
		const lemma = buildEnglishWalkLemma();
		const unresolvedSurface = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			language: "English",
			normalizedFullSurface: "walk",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "walk",
			},
		} satisfies Surface<"English", "Standard", "Lemma", "Lexeme", "VERB">;

		expect(
			lingOperation.resolve.unresolvedSurface.withLemma(
				unresolvedSurface,
				lemma,
			),
		).toEqual({
			...unresolvedSurface,
			target: lemma,
		});
	});

	it("unresolves resolved surfaces and leaves unresolved ones alone", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface =
			lingOperation.convert.lemma.toResolvedLemmaSurface(lemma);
		const unresolvedSurface = lingOperation.unresolve.surface(
			resolvedSurface,
		);

		expect(unresolvedSurface).toEqual({
			...resolvedSurface,
			target: {
				canonicalLemma: "walk",
			},
		});
		expect(lingOperation.extract.lemma.fromSurface(unresolvedSurface)).toBe(
			null,
		);
		expect(
			lingOperation.unresolve.surface(unresolvedSurface),
		).toBe(unresolvedSurface);
	});

	it("rejects resolving unresolved surfaces with non-matching lemmas", () => {
		const unresolvedSurface = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			language: "English",
			normalizedFullSurface: "walk",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "walk",
			},
		} satisfies Surface<"English", "Standard", "Lemma", "Lexeme", "VERB">;

		expect(() =>
			lingOperation.resolve.unresolvedSurface.withLemma(
				unresolvedSurface,
				buildGermanFeminineSeeLemma() as never,
			),
		).toThrow(
			"lingOperation language mismatch: expected English, received German",
		);
		expect(() =>
			lingOperation.resolve.unresolvedSurface.withLemma(
				unresolvedSurface,
				{
					...buildEnglishWalkLemma(),
					canonicalLemma: "stroll",
				},
			),
		).toThrow(
			"lingOperation canonical lemma mismatch: expected walk, received stroll",
		);
		expect(() =>
			lingOperation.resolve.unresolvedSurface.withLemma(
				unresolvedSurface,
				{
					canonicalLemma: "walk",
					inherentFeatures: {},
					language: "English",
					lemmaKind: "Lexeme",
					meaningInEmojis: "🚶",
					pos: "NOUN",
				} as never,
			),
		).toThrow(
			"lingOperation surface/lemma discriminator mismatch: expected Lexeme/VERB, received Lexeme/NOUN",
		);
	});

	it("wraps surfaces into valid standard full selections and honors overrides", () => {
		const lemma = buildEnglishWalkLemma();
		const resolvedSurface =
			lingOperation.convert.lemma.toResolvedLemmaSurface(lemma);

		const selection = lingOperation.convert.surface.toStandardFullSelection(
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
			lingOperation.convert.lemma.toStandardFullSelection(lemma, {
				spelledSelection: "Walk",
			}),
		).toEqual(
			lingOperation.convert.surface.toStandardFullSelection(
				lingOperation.convert.lemma.toResolvedLemmaSurface(lemma),
				{
					spelledSelection: "Walk",
				},
			),
		);
	});

	it("enforces bound language matching at runtime", () => {
		const germanOps = lingOperation.forLanguage("German");
		type GermanLemmaInput = Parameters<
			typeof germanOps.convert.lemma.toResolvedLemmaSurface
		>[0];
		type GermanSurfaceInput = Parameters<
			typeof germanOps.convert.surface.toStandardFullSelection
		>[0];
		type GermanUnresolvedSurfaceInput = Parameters<
			typeof germanOps.resolve.unresolvedSurface.withLemma
		>[0];
		type GermanResolvedLemmaInput = Parameters<
			typeof germanOps.resolve.unresolvedSurface.withLemma
		>[1];
		type GermanSurfaceForUnresolve = Parameters<
			typeof germanOps.unresolve.surface
		>[0];

		expect(() =>
			germanOps.convert.lemma.toResolvedLemmaSurface(
				buildEnglishWalkLemma() as unknown as GermanLemmaInput,
			),
		).toThrow(
			"lingOperation language mismatch: expected German, received English",
		);
		expect(() =>
			germanOps.convert.surface.toStandardFullSelection(
				lingOperation.convert.lemma.toResolvedLemmaSurface(
					buildEnglishWalkLemma(),
				) as unknown as GermanSurfaceInput,
			),
		).toThrow(
			"lingOperation language mismatch: expected German, received English",
		);
		expect(() =>
			germanOps.resolve.unresolvedSurface.withLemma(
				{
					discriminators: {
						lemmaKind: "Lexeme",
						lemmaSubKind: "NOUN",
					},
					language: "English",
					normalizedFullSurface: "walk",
					surfaceKind: "Lemma",
					target: {
						canonicalLemma: "walk",
					},
				} as unknown as GermanUnresolvedSurfaceInput,
				buildGermanFeminineSeeLemma() as unknown as GermanResolvedLemmaInput,
			),
		).toThrow(
			"lingOperation language mismatch: expected German, received English",
		);
		expect(() =>
			germanOps.unresolve.surface(
				lingOperation.convert.lemma.toResolvedLemmaSurface(
					buildEnglishWalkLemma(),
				) as unknown as GermanSurfaceForUnresolve,
			),
		).toThrow(
			"lingOperation language mismatch: expected German, received English",
		);
	});

	it("returns language-bound results with the same structural behavior", () => {
		const germanLemma = buildGermanFeminineSeeLemma();
		const germanOps = lingOperation.forLanguage("German");

		expect(
			germanOps.convert.lemma.toResolvedLemmaSurface(germanLemma),
		).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			language: "German",
			normalizedFullSurface: "See",
			surfaceKind: "Lemma",
			target: germanLemma,
		});
		expect(
			germanOps.unresolve.surface(
				germanOps.convert.lemma.toResolvedLemmaSurface(germanLemma),
			),
		).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			language: "German",
			normalizedFullSurface: "See",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
			},
		});
	});
});
