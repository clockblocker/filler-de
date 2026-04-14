import { describe, expect, it } from "bun:test";
import type {
	AnyLemma,
	LingIdSurfaceInput,
	ParsedLemmaDto,
	ParsedSurfaceDto,
} from "../src";
import {
	buildToLemmaLingIdFor,
	buildToLingIdFor,
	buildToShallowSurfaceLingIdFor,
	buildToSurfaceLingIdFor,
	LemmaSchema,
	parseLingId,
	SurfaceSchema,
} from "../src";

describe("Ling IDs", () => {
	const toGermanLemmaLingId = buildToLemmaLingIdFor("German");
	const toGermanSurfaceLingId = buildToSurfaceLingIdFor("German");
	const toGermanShallowSurfaceLingId =
		buildToShallowSurfaceLingIdFor("German");
	const toEnglishLemmaLingId = buildToLemmaLingIdFor("English");
	const toEnglishSurfaceLingId = buildToSurfaceLingIdFor("English");
	const toEnglishShallowSurfaceLingId =
		buildToShallowSurfaceLingIdFor("English");

	it("serializes lemma identity with full feature bags and morpheme extras", () => {
		const separableVerb = {
			canonicalLemma: "untergehen",
			inherentFeatures: {
				separable: true,
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "VERB",
		} satisfies AnyLemma<"German">;

		const inseparableVerb = {
			...separableVerb,
			inherentFeatures: {
				separable: false,
			},
		} satisfies AnyLemma<"German">;

		const feminineSee = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
		} satisfies AnyLemma<"German">;

		const neuterSee = {
			...feminineSee,
			inherentFeatures: {
				gender: "Neut",
			},
		} satisfies AnyLemma<"German">;

		const prefixWithSeparable = {
			canonicalLemma: "ab-",
			language: "German",
			lemmaKind: "Morpheme",
			morphemeKind: "Prefix",
			separable: true,
		} satisfies AnyLemma<"German">;

		const prefixWithoutSeparable = {
			canonicalLemma: "ab-",
			language: "German",
			lemmaKind: "Morpheme",
			morphemeKind: "Prefix",
		} satisfies AnyLemma<"German">;

		const englishWalk = {
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			pos: "VERB",
		} satisfies AnyLemma<"English">;

		expect(toGermanLemmaLingId(separableVerb)).toBe(
			"ling:v1:DE:LEM;untergehen;Lexeme;VERB;separable=Yes;-",
		);
		expect(toGermanLemmaLingId(inseparableVerb)).toBe(
			"ling:v1:DE:LEM;untergehen;Lexeme;VERB;separable=No;-",
		);
		expect(toGermanLemmaLingId(separableVerb)).not.toBe(
			toGermanLemmaLingId(inseparableVerb),
		);
		expect(toGermanLemmaLingId(feminineSee)).not.toBe(
			toGermanLemmaLingId(neuterSee),
		);
		expect(toGermanLemmaLingId(prefixWithSeparable)).toBe(
			"ling:v1:DE:LEM;ab%2D;Morpheme;Prefix;separable=Yes;-",
		);
		expect(toGermanLemmaLingId(prefixWithSeparable)).not.toBe(
			toGermanLemmaLingId(prefixWithoutSeparable),
		);
		expect(toEnglishLemmaLingId(englishWalk)).toBe(
			"ling:v1:EN:LEM;walk;Lexeme;VERB;-;-",
		);
	});

	it("serializes surface identity with nested lemma ids and sorted inflectional features", () => {
		const walkLemma: AnyLemma<"English"> = {
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		};
		const fullSurface: LingIdSurfaceInput<"English"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Inflection",
			target: {
				lemma: walkLemma,
			},
		};
		const shallowSurface: LingIdSurfaceInput<"English"> = {
			...fullSurface,
			target: {
				canonicalLemma: "walk",
			},
		};
		const lemmaSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
			},
		};
		const nestedLemmaId = toEnglishLemmaLingId(walkLemma);
		const fullSurfaceId = toEnglishSurfaceLingId(fullSurface);

		expect(fullSurfaceId).toBe(
			`ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;lemma;${nestedLemmaId}`,
		);
		expect(toEnglishSurfaceLingId(shallowSurface)).not.toBe(fullSurfaceId);
		expect(fullSurfaceId.split(";lemma;")[1]).toBe(nestedLemmaId);
		expect(toGermanSurfaceLingId(lemmaSurface)).toBe(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;canon;See",
		);
	});

	it("keeps shallow surface ids stable across target richness but sensitive to shell changes", () => {
		const feminineSeeLemma: AnyLemma<"German"> = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
		};
		const neuterSeeLemma: AnyLemma<"German"> = {
			...feminineSeeLemma,
			inherentFeatures: {
				gender: "Neut",
			},
		};
		const canonicalSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
			},
		};
		const feminineSurface: LingIdSurfaceInput<"German"> = {
			...canonicalSurface,
			target: {
				lemma: feminineSeeLemma,
			},
		};
		const neuterSurface: LingIdSurfaceInput<"German"> = {
			...canonicalSurface,
			target: {
				lemma: neuterSeeLemma,
			},
		};
		const walkPres: LingIdSurfaceInput<"English"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Inflection",
			target: {
				canonicalLemma: "walk",
			},
		};
		const walkPast: LingIdSurfaceInput<"English"> = {
			...walkPres,
			inflectionalFeatures: {
				tense: "Past",
				verbForm: "Fin",
			},
		};

		expect(toGermanShallowSurfaceLingId(canonicalSurface)).toBe(
			toGermanShallowSurfaceLingId(feminineSurface),
		);
		expect(toGermanShallowSurfaceLingId(feminineSurface)).toBe(
			toGermanShallowSurfaceLingId(neuterSurface),
		);
		expect(toEnglishShallowSurfaceLingId(walkPres)).not.toBe(
			toEnglishShallowSurfaceLingId(walkPast),
		);
	});

	it("round-trips lemma ids as plain dto objects", () => {
		const morpheme: AnyLemma<"German"> = {
			canonicalLemma: "ab-",
			isClosedSet: false,
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
			separable: true,
		};
		const id = toGermanLemmaLingId(morpheme);
		const parsed = parseLingId(id) as ParsedLemmaDto;

		expect(parsed.lingKind).toBe("Lemma");
		expect(parsed.lemmaKind).toBe("Morpheme");
		if (parsed.lemmaKind !== "Morpheme") {
			throw new Error("expected morpheme dto");
		}
		expect(parsed.isClosedSet).toBe(false);
		expect(parsed.separable).toBe(true);
		expect({ ...parsed }).toEqual({
			canonicalLemma: "ab-",
			isClosedSet: false,
			language: "German",
			lemmaKind: "Morpheme",
			lingKind: "Lemma",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
			separable: true,
		});
		expect(JSON.parse(JSON.stringify(parsed))).toEqual({ ...parsed });
		expect(structuredClone(parsed)).toEqual(parsed);
		expect(toGermanLemmaLingId(parsed)).toBe(id);
		expect(
			LemmaSchema.German.Morpheme.Prefix.safeParse(parsed).success,
		).toBe(true);
		expect(
			LemmaSchema.German.Morpheme.Prefix.safeParse({
				...parsed,
				lingKind: "Surface",
			}).success,
		).toBe(false);
	});

	it("round-trips surface ids as plain dto objects and preserves target branches", () => {
		const feminineSeeLemma: AnyLemma<"German"> = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
		};
		const fullSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				lemma: feminineSeeLemma,
			},
		};
		const shallowSurface: LingIdSurfaceInput<"German"> = {
			...fullSurface,
			target: {
				canonicalLemma: "See",
			},
		};
		const fullId = toGermanSurfaceLingId(fullSurface);
		const shallowId = toGermanSurfaceLingId(shallowSurface);
		const parsedFull = parseLingId(fullId) as ParsedSurfaceDto;
		const parsedShallow = parseLingId(shallowId) as ParsedSurfaceDto;

		expect(parsedFull.lingKind).toBe("Surface");
		expect("lemma" in parsedFull.target).toBe(true);
		if ("lemma" in parsedFull.target) {
			expect(parsedFull.target.lemma.lingKind).toBe("Lemma");
			expect(parsedFull.target.lemma.canonicalLemma).toBe("See");
		}
		expect("canonicalLemma" in parsedShallow.target).toBe(true);
		expect({ ...parsedFull }).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			language: "German",
			lingKind: "Surface",
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				lemma: {
					canonicalLemma: "See",
					inherentFeatures: {
						gender: "Fem",
					},
					language: "German",
					lemmaKind: "Lexeme",
					lingKind: "Lemma",
					pos: "NOUN",
				},
			},
		});
		expect(JSON.parse(JSON.stringify(parsedFull))).toEqual({
			...parsedFull,
		});
		expect(structuredClone(parsedFull)).toEqual(parsedFull);
		expect(toGermanSurfaceLingId(parsedFull)).toBe(fullId);
		expect(toGermanSurfaceLingId(parsedShallow)).toBe(shallowId);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse(
				parsedFull,
			).success,
		).toBe(true);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse(
				parsedShallow,
			).success,
		).toBe(true);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				language: "English",
			}).success,
		).toBe(false);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				orthographicStatus: "Typo",
			}).success,
		).toBe(false);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				lingKind: "Lemma",
			}).success,
		).toBe(false);
	});

	it("implements the required See ambiguity matrix", () => {
		const feminineSeeLemma: AnyLemma<"German"> = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
		};
		const neuterSeeLemma: AnyLemma<"German"> = {
			...feminineSeeLemma,
			inherentFeatures: {
				gender: "Neut",
			},
		};
		const shallowSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
			},
		};
		const fullFemSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: {
				lemma: feminineSeeLemma,
			},
		};
		const sameFullFemSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: {
				lemma: feminineSeeLemma,
			},
		};
		const fullNeuterSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: {
				lemma: neuterSeeLemma,
			},
		};

		expect(toGermanSurfaceLingId(fullFemSurface)).toBe(
			toGermanSurfaceLingId(sameFullFemSurface),
		);
		expect(toGermanSurfaceLingId(fullFemSurface)).not.toBe(
			toGermanSurfaceLingId(fullNeuterSurface),
		);
		expect(toGermanSurfaceLingId(shallowSurface)).toBe(
			toGermanSurfaceLingId({
				...shallowSurface,
				target: {
					canonicalLemma: "See",
				},
			}),
		);
		expect(toGermanSurfaceLingId(shallowSurface)).not.toBe(
			toGermanSurfaceLingId(fullFemSurface),
		);
		const shallowIds = [
			toGermanShallowSurfaceLingId(shallowSurface),
			toGermanShallowSurfaceLingId(fullFemSurface),
			toGermanShallowSurfaceLingId(sameFullFemSurface),
			toGermanShallowSurfaceLingId(fullNeuterSurface),
		];

		expect(new Set(shallowIds).size).toBe(1);
	});

	it("supports the convenience dispatcher", () => {
		const toGermanLingId = buildToLingIdFor("German");
		const lemma: AnyLemma<"German"> = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
		};
		const surface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
			},
		};

		expect(toGermanLingId(lemma)).toBe(toGermanLemmaLingId(lemma));
		expect(toGermanLingId(surface)).toBe(toGermanSurfaceLingId(surface));
	});

	it("rejects nested full target lemmas with a mismatched language", () => {
		const toGermanSurfaceLingId = buildToSurfaceLingIdFor("German");
		const malformedSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				lemma: {
					canonicalLemma: "walk",
					inherentFeatures: {},
					language: "English",
					lemmaKind: "Lexeme",
					pos: "VERB",
				},
			},
		};

		expect(() => toGermanSurfaceLingId(malformedSurface)).toThrow(
			/Ling ID builder language mismatch/,
		);
	});
});
