import { z } from "zod/v3";
import type {
	LexicalAdjectiveClassification,
	LexicalAdjectiveDistribution,
	LexicalAdjectiveGovernedPattern,
	LexicalAdjectiveGradability,
	LexicalCase,
	LexicalGenus,
	LexicalMorphemeKind,
	LexicalNounClass,
	LexicalNumber,
	LexicalPhrasemeKind,
	LexicalPos,
	LexicalSurfaceKind,
	LexicalVerbConjugation,
	LexicalVerbReflexivity,
	LexicalVerbSeparability,
} from "../public-types";

const lexicalPosValues = [
	"Noun",
	"Pronoun",
	"Article",
	"Adjective",
	"Verb",
	"Preposition",
	"Adverb",
	"Particle",
	"Conjunction",
	"InteractionalUnit",
] as const satisfies readonly LexicalPos[];

export const LexicalPosSchema = z.enum(lexicalPosValues);
export const LEXICAL_POS_VALUES = LexicalPosSchema.options;

const lexicalPhrasemeKindValues = [
	"Idiom",
	"Collocation",
	"DiscourseFormula",
	"Proverb",
	"CulturalQuotation",
] as const satisfies readonly LexicalPhrasemeKind[];

export const LexicalPhrasemeKindSchema = z.enum(lexicalPhrasemeKindValues);
export const LEXICAL_PHRASEME_KIND_VALUES = LexicalPhrasemeKindSchema.options;

const lexicalSurfaceKindValues = ["Lemma", "Inflected", "Variant"] as const satisfies readonly LexicalSurfaceKind[];

export const LexicalSurfaceKindSchema = z.enum(lexicalSurfaceKindValues);

const lexicalLinguisticUnitKindValues = ["Phrasem", "Lexem", "Morphem"] as const;

export const LexicalLinguisticUnitKindSchema = z.enum(
	lexicalLinguisticUnitKindValues,
);

const lexicalCaseValues = [
	"Nominative",
	"Accusative",
	"Dative",
	"Genitive",
] as const satisfies readonly LexicalCase[];

export const LexicalCaseSchema = z.enum(lexicalCaseValues);

const lexicalNumberValues = ["Singular", "Plural"] as const satisfies readonly LexicalNumber[];

export const LexicalNumberSchema = z.enum(lexicalNumberValues);

const lexicalGenusValues = [
	"Maskulinum",
	"Femininum",
	"Neutrum",
] as const satisfies readonly LexicalGenus[];

export const LexicalGenusSchema = z.enum(lexicalGenusValues);

const lexicalNounClassValues = ["Common", "Proper"] as const satisfies readonly LexicalNounClass[];

export const LexicalNounClassSchema = z.enum(lexicalNounClassValues);

const lexicalMorphemeKindValues = [
	"Root",
	"Prefix",
	"Suffix",
	"Suffixoid",
	"Circumfix",
	"Interfix",
	"Duplifix",
] as const satisfies readonly LexicalMorphemeKind[];

export const LexicalMorphemeKindSchema = z.enum(lexicalMorphemeKindValues);

const separabilityValues = [
	"Separable",
	"Inseparable",
] as const satisfies readonly Exclude<LexicalVerbSeparability, "None">[];

export const SeparabilitySchema = z.enum(separabilityValues);

const lexicalAdjectiveClassificationValues = [
	"Qualitative",
	"Relational",
	"Participial",
] as const satisfies readonly LexicalAdjectiveClassification[];

export const LexicalAdjectiveClassificationSchema = z.enum(
	lexicalAdjectiveClassificationValues,
);

const lexicalAdjectiveDistributionValues = [
	"AttributiveAndPredicative",
	"AttributiveOnly",
	"PredicativeOnly",
] as const satisfies readonly LexicalAdjectiveDistribution[];

export const LexicalAdjectiveDistributionSchema = z.enum(
	lexicalAdjectiveDistributionValues,
);

const lexicalAdjectiveGradabilityValues = [
	"Gradable",
	"NonGradable",
] as const satisfies readonly LexicalAdjectiveGradability[];

export const LexicalAdjectiveGradabilitySchema = z.enum(
	lexicalAdjectiveGradabilityValues,
);

const lexicalAdjectiveGovernedPatternValues = [
	"None",
	"Dative",
	"Accusative",
	"Genitive",
	"Prepositional",
	"ZuInfinitive",
	"DassClause",
] as const satisfies readonly LexicalAdjectiveGovernedPattern[];

export const LexicalAdjectiveGovernedPatternSchema = z.enum(
	lexicalAdjectiveGovernedPatternValues,
);

export const LexicalAdjectiveValencySchema = z
	.object({
		governedPattern: LexicalAdjectiveGovernedPatternSchema,
		governedPreposition: z.string().min(1).max(30).nullable().optional(),
	})
	.superRefine((value, ctx) => {
		const governedPreposition = value.governedPreposition ?? undefined;

		if (value.governedPattern === "Prepositional" && !governedPreposition) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"governedPreposition is required when governedPattern is Prepositional",
				path: ["governedPreposition"],
			});
			return;
		}

		if (value.governedPattern !== "Prepositional" && governedPreposition) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"governedPreposition is allowed only when governedPattern is Prepositional",
				path: ["governedPreposition"],
			});
		}
	});

const lexicalVerbConjugationValues = [
	"Irregular",
	"Regular",
] as const satisfies readonly LexicalVerbConjugation[];

export const LexicalVerbConjugationSchema = z.enum(
	lexicalVerbConjugationValues,
);

const lexicalVerbSeparabilityValues = [
	"Separable",
	"Inseparable",
	"None",
] as const satisfies readonly LexicalVerbSeparability[];

export const LexicalVerbSeparabilitySchema = z.enum(
	lexicalVerbSeparabilityValues,
);

const lexicalVerbReflexivityValues = [
	"NonReflexive",
	"ReflexiveOnly",
	"OptionalReflexive",
] as const satisfies readonly LexicalVerbReflexivity[];

export const LexicalVerbReflexivitySchema = z.enum(
	lexicalVerbReflexivityValues,
);

export const LexicalVerbValencySchema = z.object({
	governedPreposition: z.string().min(1).max(30).nullable().optional(),
	reflexivity: LexicalVerbReflexivitySchema,
	separability: LexicalVerbSeparabilitySchema,
});
