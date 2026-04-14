import { describe, expect, it } from "bun:test";
import type {
	Lemma,
	OrthographicStatus,
	ParsedObservedSurfaceDto,
	ParsedShallowSurfaceDto,
	ParsedSurfaceDto,
	ParsedTargetedSurfaceDto,
	Surface,
} from "../../src";
import { buildToLingConverters, SurfaceSchema } from "../../src";

type TestLanguage = "German" | "English";

type LingIdSurfaceInput<L extends TestLanguage> = Surface<L> & {
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
};

type ParsedTargetedSurface<L extends TestLanguage = TestLanguage> =
	ParsedTargetedSurfaceDto & { language: L };

type ParsedSurface<L extends TestLanguage = TestLanguage> = ParsedSurfaceDto & {
	language: L;
};

describe("Ling ID usage", () => {
	const germanLingConverters = buildToLingConverters("German");
	const englishLingConverters = buildToLingConverters("English");
	const {
		getShallowSurfaceLingId: toGermanShallowSurfaceLingId,
		getSurfaceLingId: toGermanSurfaceLingId,
		parseShallowSurface: parseGermanShallowSurface,
		parseSurface: parseGermanSurface,
	} = germanLingConverters;
	const {
		getShallowSurfaceLingId: toEnglishShallowSurfaceLingId,
		getSurfaceLingId: toEnglishSurfaceLingId,
		parseSurface: parseEnglishSurface,
	} = englishLingConverters;

	it("serializes lemma input as observed surface identity", () => {
		const separableVerb = {
			canonicalLemma: "untergehen",
			inherentFeatures: {
				separable: true,
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌅",
			pos: "VERB",
		} satisfies Lemma<"German", "Lexeme", "VERB">;

		const inseparableVerb = {
			...separableVerb,
			inherentFeatures: {
				separable: false,
			},
		} satisfies Lemma<"German", "Lexeme", "VERB">;

		const feminineSee = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

		const neuterSee = {
			...feminineSee,
			inherentFeatures: {
				gender: "Neut",
			},
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

		const prefixWithSeparable = {
			canonicalLemma: "ab-",
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
			separable: true,
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const prefixWithoutSeparable = {
			...prefixWithSeparable,
			separable: undefined,
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const englishWalk = {
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		} satisfies Lemma<"English", "Lexeme", "VERB">;

		expect(toGermanSurfaceLingId(separableVerb)).toBe(
			"ling:v1:DE:SURF;untergehen;Standard;Lemma;Lexeme;VERB;-;observed;untergehen;Lexeme;VERB;separable=Yes;🌅",
		);
		expect(toGermanSurfaceLingId(inseparableVerb)).toBe(
			"ling:v1:DE:SURF;untergehen;Standard;Lemma;Lexeme;VERB;-;observed;untergehen;Lexeme;VERB;separable=No;🌅",
		);
		expect(toGermanSurfaceLingId(separableVerb)).not.toBe(
			toGermanSurfaceLingId(inseparableVerb),
		);
		expect(toGermanSurfaceLingId(feminineSee)).not.toBe(
			toGermanSurfaceLingId(neuterSee),
		);
		expect(toGermanSurfaceLingId(prefixWithSeparable)).toBe(
			"ling:v1:DE:SURF;ab%2D;Standard;Lemma;Morpheme;Prefix;-;observed;ab%2D;Morpheme;Prefix;separable=Yes;🧩",
		);
		expect(toGermanSurfaceLingId(prefixWithSeparable)).not.toBe(
			toGermanSurfaceLingId(prefixWithoutSeparable),
		);
		expect(toEnglishSurfaceLingId(englishWalk)).toBe(
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;observed;walk;Lexeme;VERB;-;🚶",
		);
	});

	it("serializes targeted surface identity with nested lemma payloads and sorted inflectional features", () => {
		const walkLemma = {
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		} satisfies Lemma<"English", "Lexeme", "VERB">;

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
			target: walkLemma,
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

		const fullSurfaceId = toEnglishSurfaceLingId(fullSurface);

		expect(fullSurfaceId).toBe(
			"ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;lemma;walk;Lexeme;VERB;-;🚶",
		);
		expect(toEnglishSurfaceLingId(shallowSurface)).not.toBe(fullSurfaceId);
		expect(fullSurfaceId.split(";lemma;")[1]).toBe("walk;Lexeme;VERB;-;🚶");
		expect(toGermanSurfaceLingId(lemmaSurface)).toBe(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;canon;See",
		);
	});

	it("keeps shallow surface ids stable across target richness but sensitive to shell changes", () => {
		const feminineSeeLemma = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

		const neuterSeeLemma = {
			...feminineSeeLemma,
			inherentFeatures: {
				gender: "Neut",
			},
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

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
			target: feminineSeeLemma,
		};

		const neuterSurface: LingIdSurfaceInput<"German"> = {
			...canonicalSurface,
			target: neuterSeeLemma,
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

	it("round-trips observed surface ids as plain dto objects", () => {
		const morpheme = {
			canonicalLemma: "ab-",
			isClosedSet: false,
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
			separable: true,
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const id = toGermanSurfaceLingId(morpheme);

		const parsed = parseGermanSurface(id) as ParsedObservedSurfaceDto;

		expect(parsed.observationMode).toBe("observed");
		expect(parsed.target.lemmaKind).toBe("Morpheme");
		expect({ ...parsed }).toEqual({
			discriminators: {
				lemmaKind: "Morpheme",
				lemmaSubKind: "Prefix",
			},
			language: "German",
			lingKind: "Surface",
			normalizedFullSurface: "ab-",
			observationMode: "observed",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "ab-",
				isClosedSet: false,
				language: "German",
				lemmaKind: "Morpheme",
				lingKind: "Lemma",
				meaningInEmojis: "🧩",
				morphemeKind: "Prefix",
				separable: true,
			},
		});
		expect(JSON.parse(JSON.stringify(parsed))).toEqual({ ...parsed });
		expect(structuredClone(parsed)).toEqual(parsed);
		expect(toGermanSurfaceLingId(parsed)).toBe(id);
		expect(
			SurfaceSchema.German.Standard.Lemma.Morpheme.Prefix.safeParse(
				parsed,
			).success,
		).toBe(false);
	});

	it("canonicalizes observed surface dto shells on reserialization", () => {
		const observed = parseGermanSurface(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-",
		) as ParsedObservedSurfaceDto;

		const mutatedObserved: ParsedObservedSurfaceDto = {
			...observed,
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			normalizedFullSurface: "Bogus",
		};

		expect(toGermanSurfaceLingId(mutatedObserved)).toBe(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-",
		);
	});

	it("round-trips targeted surface ids as plain dto objects and preserves target branches", () => {
		const feminineSeeLemma = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

		const fullSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: feminineSeeLemma,
		};

		const shallowSurface: LingIdSurfaceInput<"German"> = {
			...fullSurface,
			target: {
				canonicalLemma: "See",
			},
		};

		const fullId = toGermanSurfaceLingId(fullSurface);

		const shallowId = toGermanSurfaceLingId(shallowSurface);

		const parsedFull = parseGermanSurface(
			fullId,
		) as ParsedTargetedSurface<"German">;

		const parsedShallow = parseGermanSurface(
			shallowId,
		) as ParsedTargetedSurface<"German">;

		expect("lemmaKind" in parsedFull.target).toBe(true);
		if ("lemmaKind" in parsedFull.target) {
			expect(parsedFull.target.lingKind).toBe("Lemma");
			expect(parsedFull.target.canonicalLemma).toBe("See");
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
				canonicalLemma: "See",
				inherentFeatures: {
					gender: "Fem",
				},
				language: "German",
				lemmaKind: "Lexeme",
				lingKind: "Lemma",
				meaningInEmojis: "🌊",
				pos: "NOUN",
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
		const feminineSeeLemma = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

		const neuterSeeLemma = {
			...feminineSeeLemma,
			inherentFeatures: {
				gender: "Neut",
			},
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

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
			target: feminineSeeLemma,
		};

		const sameFullFemSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: feminineSeeLemma,
		};

		const fullNeuterSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: neuterSeeLemma,
		};

		const observedFemSurface = toGermanSurfaceLingId(feminineSeeLemma);

		const observedNeuterSurface = toGermanSurfaceLingId(neuterSeeLemma);

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
		expect(observedFemSurface).not.toBe(observedNeuterSurface);

		const shallowIds = [
			toGermanShallowSurfaceLingId(shallowSurface),
			toGermanShallowSurfaceLingId(fullFemSurface),
			toGermanShallowSurfaceLingId(sameFullFemSurface),
			toGermanShallowSurfaceLingId(fullNeuterSurface),
		];

		expect(new Set(shallowIds).size).toBe(1);
	});

	it("supports the convenience dispatcher with observed-surface semantics", () => {
		const lemma = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

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

		expect(germanLingConverters.getSurfaceLingId(lemma)).toBe(
			toGermanSurfaceLingId(lemma),
		);
		expect(germanLingConverters.getSurfaceLingId(surface)).toBe(
			toGermanSurfaceLingId(surface),
		);
	});

	it("rejects nested full target lemmas with a mismatched language", () => {
		const malformedSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "walk",
				inherentFeatures: {},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚶",
				pos: "VERB",
			},
		};

		expect(() => toGermanSurfaceLingId(malformedSurface)).toThrow(
			/Ling ID builder language mismatch/,
		);
	});

	it("accepts observed surfaces and rejects lemma input in the shallow surface serializer", () => {
		const lemma = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

		const observedSurface = parseGermanSurface(
			toGermanSurfaceLingId(lemma),
		) as ParsedObservedSurfaceDto;

		expect(() =>
			toGermanShallowSurfaceLingId(
				lemma as unknown as LingIdSurfaceInput<"German">,
			),
		).toThrow(/surface input/);
		expect(
			toGermanShallowSurfaceLingId(
				observedSurface as unknown as ParsedTargetedSurface<"German">,
			),
		).toBe("ling:v1:DE:SURF-SHALLOW;See;Standard;Lemma;Lexeme;NOUN;-");
	});

	it("does not preserve compatibility with the removed top-level lemma format", () => {
		expect(() =>
			parseGermanSurface("ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Fem;-"),
		).toThrow(/Unsupported Ling ID kind: LEM/);
	});

	it("round-trips shallow surface ids as plain dto objects", () => {
		const shallowId =
			"ling:v1:DE:SURF-SHALLOW;See;Standard;Lemma;Lexeme;NOUN;-";

		const parsedShallowSurface = parseGermanShallowSurface(
			shallowId,
		) as ParsedShallowSurfaceDto;

		expect({ ...parsedShallowSurface }).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			language: "German",
			lingKind: "Surface",
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
		});
		expect(toGermanShallowSurfaceLingId(parsedShallowSurface)).toBe(
			shallowId,
		);
	});

	it("parses reserialized dto objects across both surface branches", () => {
		const targetedId =
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;canon;walk";

		const observedId =
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;observed;walk;Lexeme;VERB;-;-";

		const parsedTargeted = parseEnglishSurface(
			targetedId,
		) as ParsedSurface<"English">;

		const parsedObserved = parseEnglishSurface(
			observedId,
		) as ParsedSurface<"English">;

		expect(toEnglishSurfaceLingId(parsedTargeted)).toBe(targetedId);
		expect(toEnglishSurfaceLingId(parsedObserved)).toBe(observedId);
	});
});
