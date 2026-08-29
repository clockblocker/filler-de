import { z } from "zod/v3";

const linguisticUnitKinds = ["Phrasem", "Lexem", "Morphem"] as const;

const LinguisticUnitKindSchema = z.enum(linguisticUnitKinds);
export const LexicalLinguisticUnitKindSchema = LinguisticUnitKindSchema;

const surfaceKinds = ["Lemma", "Inflected", "Variant", "Partial"] as const;

const SurfaceKindSchema = z.enum(surfaceKinds);
export const LexicalSurfaceKindSchema = SurfaceKindSchema;

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
] as const;

const LexicalPosSchema = z.enum(lexicalPosValues);
export const LEXICAL_POS_VALUES = LexicalPosSchema.options;





const lexicalPhrasemeKindValues = [
	"Idiom",
	"Collocation",
	"DiscourseFormula",
	"Proverb",
	"CulturalQuotation",
] as const;

export const LexicalPhrasemeKindSchema = z.enum(lexicalPhrasemeKindValues);
export const LEXICAL_PHRASEME_KIND_VALUES = LexicalPhrasemeKindSchema.options;

const lexicalMorphemeKinds = [
	"Root",
	"Prefix",
	"Suffix",
	"Suffixoid",
	"Infix",
	"Circumfix",
	"Interfix",
	"Transfix",
	"Clitic",
	"ToneMarking",
	"Duplifix",
] as const;

export const LexicalMorphemeKindSchema = z.enum(lexicalMorphemeKinds);

const lexicalCaseValues = [
	"Nominative",
	"Accusative",
	"Dative",
	"Genitive",
] as const;

export const LexicalCaseSchema = z.enum(lexicalCaseValues);

const lexicalNumberValues = ["Singular", "Plural"] as const;

export const LexicalNumberSchema = z.enum(lexicalNumberValues);

const lexicalGenusValues = ["Maskulinum", "Femininum", "Neutrum"] as const;

export const LexicalGenusSchema = z.enum(lexicalGenusValues);

const lexicalNounClassValues = ["Common", "Proper"] as const;

export const LexicalNounClassSchema = z.enum(lexicalNounClassValues);

const lexicalAdjectiveClassificationValues = [
	"Qualitative",
	"Relational",
	"Participial",
] as const;

export const LexicalAdjectiveClassificationSchema = z.enum(
	lexicalAdjectiveClassificationValues,
);

const lexicalAdjectiveGradabilityValues = ["Gradable", "NonGradable"] as const;

export const LexicalAdjectiveGradabilitySchema = z.enum(
	lexicalAdjectiveGradabilityValues,
);

const lexicalAdjectiveDistributionValues = [
	"AttributiveAndPredicative",
	"AttributiveOnly",
	"PredicativeOnly",
] as const;

export const LexicalAdjectiveDistributionSchema = z.enum(
	lexicalAdjectiveDistributionValues,
);

const lexicalAdjectiveGovernedPatternValues = [
	"None",
	"Dative",
	"Accusative",
	"Genitive",
	"Prepositional",
	"ZuInfinitive",
	"DassClause",
] as const;

const LexicalAdjectiveGovernedPatternSchema = z.enum(
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

const lexicalVerbConjugationValues = ["Irregular", "Regular"] as const;

export const LexicalVerbConjugationSchema = z.enum(
	lexicalVerbConjugationValues,
);

const lexicalVerbSeparabilityValues = [
	"Separable",
	"Inseparable",
	"None",
] as const;

const LexicalVerbSeparabilitySchema = z.enum(lexicalVerbSeparabilityValues);

const lexicalVerbReflexivityValues = [
	"NonReflexive",
	"ReflexiveOnly",
	"OptionalReflexive",
] as const;

const LexicalVerbReflexivitySchema = z.enum(lexicalVerbReflexivityValues);

export const LexicalVerbValencySchema = z.object({
	governedPreposition: z.string().min(1).max(30).nullable().optional(),
	reflexivity: LexicalVerbReflexivitySchema,
	separability: LexicalVerbSeparabilitySchema,
});

const separabilityValues = ["Separable", "Inseparable"] as const;
export const SeparabilitySchema = z.enum(separabilityValues);
