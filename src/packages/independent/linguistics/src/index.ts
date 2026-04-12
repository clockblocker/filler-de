import z from "zod/v3";
import {
	GermanVerbInflectionSelectionSchema,
	GermanVerbLemmaSchema,
	GermanVerbLemmaSelectionSchema,
} from "./german/lu/lexeme/pos/german-verb";
import type { AbstractLemma } from "./universal/abstract-lemma";
import type { AbstractSelectionFor } from "./universal/abstract-selection";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./universal/enums/core/selection";
import { MORPHEME_KINDS } from "./universal/enums/kind/morpheme-kind";
import { PHRASEME_KINDS } from "./universal/enums/kind/phraseme-kind";
import { POS_VALUES } from "./universal/enums/kind/pos";
import type { LemmaDiscriminatorFor } from "./universal/lemma-discriminator";

const supportedTargetLanguages = ["German"] as const;

const TargetLang = z.enum(supportedTargetLanguages);
type TargetLang = z.infer<typeof TargetLang>;

function buildLeafSchemaMap<const Values extends readonly string[]>(
	values: Values,
) {
	return Object.fromEntries(
		values.map((value) => [value, z.any()]),
	) as unknown as {
		[K in Values[number]]: z.ZodTypeAny;
	};
}

function buildSelectionSurfaceMap() {
	return {
		Inflection: {
			Lexeme: buildLeafSchemaMap(POS_VALUES),
			Morpheme: buildLeafSchemaMap(MORPHEME_KINDS),
			Phraseme: buildLeafSchemaMap(PHRASEME_KINDS),
		},
		Lemma: {
			Lexeme: buildLeafSchemaMap(POS_VALUES),
			Morpheme: buildLeafSchemaMap(MORPHEME_KINDS),
			Phraseme: buildLeafSchemaMap(PHRASEME_KINDS),
		},
		Partial: {
			Lexeme: buildLeafSchemaMap(POS_VALUES),
			Morpheme: buildLeafSchemaMap(MORPHEME_KINDS),
			Phraseme: buildLeafSchemaMap(PHRASEME_KINDS),
		},
		Variant: {
			Lexeme: buildLeafSchemaMap(POS_VALUES),
			Morpheme: buildLeafSchemaMap(MORPHEME_KINDS),
			Phraseme: buildLeafSchemaMap(PHRASEME_KINDS),
		},
	};
}

const GermanSelectionSchemas = {
	Standard: buildSelectionSurfaceMap(),
	Typo: buildSelectionSurfaceMap(),
	Unknown: buildSelectionSurfaceMap(),
};

GermanSelectionSchemas.Standard.Inflection.Lexeme.VERB =
	GermanVerbInflectionSelectionSchema;
GermanSelectionSchemas.Standard.Lemma.Lexeme.VERB =
	GermanVerbLemmaSelectionSchema;

type SelectionSchemaShape = {
	[L in TargetLang]: {
		[OS in OrthographicStatus]: {
			[SK in SurfaceKind]: {
				[LK in LemmaKind]: {
					[D in LemmaDiscriminatorFor<LK>]: z.ZodType<
						AbstractSelectionFor<OS, SK, LK, D>
					>;
				};
			};
		};
	};
};

export const SelectionSchema = {
	German: GermanSelectionSchemas,
} satisfies SelectionSchemaShape;

const GermanLemmaSchemas = {
	Lexeme: buildLeafSchemaMap(POS_VALUES),
	Morpheme: buildLeafSchemaMap(MORPHEME_KINDS),
	Phraseme: buildLeafSchemaMap(PHRASEME_KINDS),
};

GermanLemmaSchemas.Lexeme.VERB = GermanVerbLemmaSchema;

type LemmaSchemaShape = {
	[L in TargetLang]: {
		[LK in LemmaKind]: {
			[D in LemmaDiscriminatorFor<LK>]: z.ZodType<AbstractLemma<LK, D>>;
		};
	};
};

export const LemmaSchema = {
	German: GermanLemmaSchemas,
} satisfies LemmaSchemaShape;
