import z from "zod/v3";
import { Case } from "../../../../universal/enums/feature/ud/case";
import { Definite } from "../../../../universal/enums/feature/ud/definite";
import { Degree } from "../../../../universal/enums/feature/ud/degree";
import { Gender } from "../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../universal/enums/feature/ud/mood";
import { NumType } from "../../../../universal/enums/feature/ud/num-type";
import { GrammaticalNumber } from "../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../universal/enums/feature/ud/person";
import { Polarity } from "../../../../universal/enums/feature/ud/polarity";
import { Polite } from "../../../../universal/enums/feature/ud/polite";
import { IsPoss } from "../../../../universal/enums/feature/ud/poss";
import { PronType } from "../../../../universal/enums/feature/ud/pron-type";
import { IsReflex } from "../../../../universal/enums/feature/ud/reflex";
import { Tense } from "../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../universal/enums/feature/ud/verb-form";
import type { Pos } from "../../../../universal/enums/kind/pos";
import {
	AbstractLexicalRelationsSchema,
	AbstractMorphologicalRelationsSchema,
} from "../../../../universal/enums/relation/relation";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import {
	GermanVerbInflectionSelectionSchema,
	GermanVerbLemmaSchema,
	GermanVerbLemmaSelectionSchema,
	GermanVerbStandardPartialSelectionSchema,
	GermanVerbStandardVariantSelectionSchema,
	GermanVerbTypoInflectionSelectionSchema,
	GermanVerbTypoLemmaSelectionSchema,
	GermanVerbTypoPartialSelectionSchema,
	GermanVerbTypoVariantSelectionSchema,
	GermanVerbUnknownSelectionSchema,
} from "../verb/german-verb-bundle";

const EmptyFeaturesSchema = z.object({}).strict();
export const GermanUnknownSelectionSchema = GermanVerbUnknownSelectionSchema;

const GermanCase = z.enum([
	Case.enum.Acc,
	Case.enum.Dat,
	Case.enum.Gen,
	Case.enum.Nom,
]);
const GermanDefinite = z.enum([Definite.enum.Def, Definite.enum.Ind]);
const GermanDegree = z.enum([
	Degree.enum.Cmp,
	Degree.enum.Pos,
	Degree.enum.Sup,
]);
const GermanGender = z.enum([
	Gender.enum.Fem,
	Gender.enum.Masc,
	Gender.enum.Neut,
]);
const GermanMood = z.enum([Mood.enum.Imp, Mood.enum.Ind, Mood.enum.Sub]);
const GermanNumber = z.enum([
	GrammaticalNumber.enum.Plur,
	GrammaticalNumber.enum.Sing,
]);
const GermanPerson = z.enum([
	Person.enum["1"],
	Person.enum["2"],
	Person.enum["3"],
]);
const GermanPronounPronType = z.enum([
	PronType.enum.Ind,
	PronType.enum.Int,
	PronType.enum.Neg,
	PronType.enum.Prs,
	PronType.enum.Rcp,
	PronType.enum.Rel,
	PronType.enum.Tot,
]);
const GermanDeterminerPronType = z.enum([
	PronType.enum.Art,
	PronType.enum.Dem,
	PronType.enum.Emp,
	PronType.enum.Ind,
	PronType.enum.Int,
	PronType.enum.Neg,
	PronType.enum.Prs,
	PronType.enum.Rel,
	PronType.enum.Tot,
]);
const GermanTense = z.enum([Tense.enum.Past, Tense.enum.Pres]);
const GermanVerbForm = z.enum([
	VerbForm.enum.Fin,
	VerbForm.enum.Inf,
	VerbForm.enum.Part,
]);
const GermanNegativePolarity = z.enum([Polarity.enum.Neg]);

type GermanLexemePosSchemaBundle = {
	inflectionSelectionSchema: z.ZodTypeAny;
	lemmaSchema: z.ZodTypeAny;
	lemmaSelectionSchema: z.ZodTypeAny;
	standardPartialSelectionSchema: z.ZodTypeAny;
	standardVariantSelectionSchema: z.ZodTypeAny;
	typoInflectionSelectionSchema: z.ZodTypeAny;
	typoLemmaSelectionSchema: z.ZodTypeAny;
	typoPartialSelectionSchema: z.ZodTypeAny;
	typoVariantSelectionSchema: z.ZodTypeAny;
	unknownSelectionSchema: z.ZodTypeAny;
};

function buildGermanLexemePosSchemaBundle<const P extends Pos>({
	inherentFeaturesSchema = EmptyFeaturesSchema,
	inflectionalFeaturesSchema = EmptyFeaturesSchema,
	pos,
}: {
	inherentFeaturesSchema?: z.ZodTypeAny;
	inflectionalFeaturesSchema?: z.ZodTypeAny;
	pos: P;
}): GermanLexemePosSchemaBundle {
	const lemmaIdentityShape = {
		lemmaKind: z.literal("Lexeme"),
		pos: z.literal(pos),
	} satisfies z.ZodRawShape;

	return {
		inflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			lemmaIdentityShape,
		}),
		lemmaSchema: z.object({
			inherentFeatures: inherentFeaturesSchema,
			lexicalRelations: AbstractLexicalRelationsSchema,
			morphologicalRelations: AbstractMorphologicalRelationsSchema,
			pos: z.literal(pos),
		}),
		lemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
		}),
		standardPartialSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			surfaceKind: "Partial",
		}),
		standardVariantSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			surfaceKind: "Variant",
		}),
		typoInflectionSelectionSchema: buildInflectionSelection({
			inflectionalFeaturesSchema,
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}),
		typoLemmaSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
		}),
		typoPartialSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Partial",
		}),
		typoVariantSelectionSchema: buildLemmaSelection({
			lemmaIdentityShape,
			orthographicStatus: "Typo",
			surfaceKind: "Variant",
		}),
		unknownSelectionSchema: GermanUnknownSelectionSchema,
	};
}

const GermanAdjectiveSchemaBundle = buildGermanLexemePosSchemaBundle({
	inflectionalFeaturesSchema: z
		.object({
			case: GermanCase.optional(),
			degree: GermanDegree.optional(),
			gender: GermanGender.optional(),
			number: GermanNumber.optional(),
		})
		.strict(),
	inherentFeaturesSchema: z
		.object({
			numType: NumType.optional(),
		})
		.strict(),
	pos: "ADJ",
});

const GermanAdpositionSchemaBundle = buildGermanLexemePosSchemaBundle({
	pos: "ADP",
});

const GermanAdverbSchemaBundle = buildGermanLexemePosSchemaBundle({
	inflectionalFeaturesSchema: z
		.object({
			degree: GermanDegree.optional(),
		})
		.strict(),
	inherentFeaturesSchema: z
		.object({
			pronType: PronType.optional(),
		})
		.strict(),
	pos: "ADV",
});

const GermanAuxiliarySchemaBundle = buildGermanLexemePosSchemaBundle({
	inflectionalFeaturesSchema: z
		.object({
			gender: GermanGender.optional(),
			mood: GermanMood.optional(),
			number: GermanNumber.optional(),
			person: GermanPerson.optional(),
			tense: GermanTense.optional(),
			verbForm: GermanVerbForm.optional(),
		})
		.strict(),
	pos: "AUX",
});

const GermanCoordinatingConjunctionSchemaBundle =
	buildGermanLexemePosSchemaBundle({
		pos: "CCONJ",
	});

const GermanDeterminerSchemaBundle = buildGermanLexemePosSchemaBundle({
	inflectionalFeaturesSchema: z
		.object({
			case: GermanCase.optional(),
			gender: GermanGender.optional(),
			number: GermanNumber.optional(),
		})
		.strict(),
	inherentFeaturesSchema: z
		.object({
			definite: GermanDefinite.optional(),
			numType: NumType.optional(),
			person: GermanPerson.optional(),
			polite: Polite.optional(),
			poss: IsPoss.optional(),
			pronType: GermanDeterminerPronType.optional(),
		})
		.strict(),
	pos: "DET",
});

const GermanInterjectionSchemaBundle = buildGermanLexemePosSchemaBundle({
	pos: "INTJ",
});

const GermanNounSchemaBundle = buildGermanLexemePosSchemaBundle({
	inflectionalFeaturesSchema: z
		.object({
			case: GermanCase.optional(),
			number: GermanNumber.optional(),
		})
		.strict(),
	inherentFeaturesSchema: z
		.object({
			gender: GermanGender.optional(),
		})
		.strict(),
	pos: "NOUN",
});

const GermanNumeralSchemaBundle = buildGermanLexemePosSchemaBundle({
	inherentFeaturesSchema: z
		.object({
			numType: NumType.optional(),
		})
		.strict(),
	pos: "NUM",
});

const GermanParticleSchemaBundle = buildGermanLexemePosSchemaBundle({
	inherentFeaturesSchema: z
		.object({
			polarity: GermanNegativePolarity.optional(),
		})
		.strict(),
	pos: "PART",
});

const GermanPronounSchemaBundle = buildGermanLexemePosSchemaBundle({
	inflectionalFeaturesSchema: z
		.object({
			case: GermanCase.optional(),
			number: GermanNumber.optional(),
			reflex: IsReflex.optional(),
		})
		.strict(),
	inherentFeaturesSchema: z
		.object({
			gender: GermanGender.optional(),
			person: GermanPerson.optional(),
			polite: Polite.optional(),
			pronType: GermanPronounPronType.optional(),
		})
		.strict(),
	pos: "PRON",
});

const GermanProperNounSchemaBundle = buildGermanLexemePosSchemaBundle({
	inflectionalFeaturesSchema: z
		.object({
			case: GermanCase.optional(),
			number: GermanNumber.optional(),
		})
		.strict(),
	inherentFeaturesSchema: z
		.object({
			gender: GermanGender.optional(),
		})
		.strict(),
	pos: "PROPN",
});

const GermanPunctuationSchemaBundle = buildGermanLexemePosSchemaBundle({
	pos: "PUNCT",
});

const GermanSubordinatingConjunctionSchemaBundle =
	buildGermanLexemePosSchemaBundle({
		pos: "SCONJ",
	});

const GermanSymbolSchemaBundle = buildGermanLexemePosSchemaBundle({
	pos: "SYM",
});

const GermanOtherSchemaBundle = buildGermanLexemePosSchemaBundle({
	pos: "X",
});

export const GermanLexemePosSchemas = {
	ADJ: GermanAdjectiveSchemaBundle,
	ADP: GermanAdpositionSchemaBundle,
	ADV: GermanAdverbSchemaBundle,
	AUX: GermanAuxiliarySchemaBundle,
	CCONJ: GermanCoordinatingConjunctionSchemaBundle,
	DET: GermanDeterminerSchemaBundle,
	INTJ: GermanInterjectionSchemaBundle,
	NOUN: GermanNounSchemaBundle,
	NUM: GermanNumeralSchemaBundle,
	PART: GermanParticleSchemaBundle,
	PRON: GermanPronounSchemaBundle,
	PROPN: GermanProperNounSchemaBundle,
	PUNCT: GermanPunctuationSchemaBundle,
	SCONJ: GermanSubordinatingConjunctionSchemaBundle,
	SYM: GermanSymbolSchemaBundle,
	VERB: {
		inflectionSelectionSchema: GermanVerbInflectionSelectionSchema,
		lemmaSchema: GermanVerbLemmaSchema,
		lemmaSelectionSchema: GermanVerbLemmaSelectionSchema,
		standardPartialSelectionSchema:
			GermanVerbStandardPartialSelectionSchema,
		standardVariantSelectionSchema:
			GermanVerbStandardVariantSelectionSchema,
		typoInflectionSelectionSchema: GermanVerbTypoInflectionSelectionSchema,
		typoLemmaSelectionSchema: GermanVerbTypoLemmaSelectionSchema,
		typoPartialSelectionSchema: GermanVerbTypoPartialSelectionSchema,
		typoVariantSelectionSchema: GermanVerbTypoVariantSelectionSchema,
		unknownSelectionSchema: GermanVerbUnknownSelectionSchema,
	},
	X: GermanOtherSchemaBundle,
} satisfies Record<Pos, GermanLexemePosSchemaBundle>;
