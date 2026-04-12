import { z } from "zod/v3";

const linguisticUnitKinds = ["Phrasem", "Lexem", "Morphem"] as const;

export const LinguisticUnitKindSchema = z.enum(linguisticUnitKinds);
export type LinguisticUnitKind = z.infer<typeof LinguisticUnitKindSchema>;
export const LinguisticUnitKind = LinguisticUnitKindSchema.enum;
export const LINGUISTIC_UNIT_KINDS = LinguisticUnitKindSchema.options;
export const LexicalLinguisticUnitKindSchema = LinguisticUnitKindSchema;

const surfaceKinds = ["Lemma", "Inflected", "Variant", "Partial"] as const;

export const SurfaceKindSchema = z.enum(surfaceKinds);
export type LexicalSurfaceKind = z.infer<typeof SurfaceKindSchema>;
export const SurfaceKind = SurfaceKindSchema.enum;
export const SURFACE_KINDS = SurfaceKindSchema.options;
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

export const LexicalPosSchema = z.enum(lexicalPosValues);
export type LexicalPos = z.infer<typeof LexicalPosSchema>;
export const POS = LexicalPosSchema.enum;
export const PARTS_OF_SPEECH = LexicalPosSchema.options;
export const LEXICAL_POS_VALUES = LexicalPosSchema.options;

const posTags = [
	"NOUN",
	"PRON",
	"ART",
	"ADJ",
	"VERB",
	"PREP",
	"ADV",
	"PART",
	"KON",
	"IU",
] as const;

export const PosTagSchema = z.enum(posTags);
export type PosTag = z.infer<typeof PosTagSchema>;
export const PosTag = PosTagSchema.enum;
export const POS_TAGS = PosTagSchema.options;

export const posTagFormFromPos: Record<LexicalPos, PosTag> = {
	Adjective: PosTag.ADJ,
	Adverb: PosTag.ADV,
	Article: PosTag.ART,
	Conjunction: PosTag.KON,
	InteractionalUnit: PosTag.IU,
	Noun: PosTag.NOUN,
	Particle: PosTag.PART,
	Preposition: PosTag.PREP,
	Pronoun: PosTag.PRON,
	Verb: PosTag.VERB,
};

export const posFormFromPosTag: Record<PosTag, LexicalPos> = {
	ADJ: POS.Adjective,
	ADV: POS.Adverb,
	ART: POS.Article,
	IU: POS.InteractionalUnit,
	KON: POS.Conjunction,
	NOUN: POS.Noun,
	PART: POS.Particle,
	PREP: POS.Preposition,
	PRON: POS.Pronoun,
	VERB: POS.Verb,
};

const lexicalPhrasemeKindValues = [
	"Idiom",
	"Collocation",
	"DiscourseFormula",
	"Proverb",
	"CulturalQuotation",
] as const;

export const LexicalPhrasemeKindSchema = z.enum(lexicalPhrasemeKindValues);
export type LexicalPhrasemeKind = z.infer<typeof LexicalPhrasemeKindSchema>;
export const LexicalPhrasemeKind = LexicalPhrasemeKindSchema.enum;
export const LEXICAL_PHRASEME_KIND_VALUES =
	LexicalPhrasemeKindSchema.options;

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
export type LexicalMorphemeKind = z.infer<typeof LexicalMorphemeKindSchema>;
export const LexicalMorphemeKind = LexicalMorphemeKindSchema.enum;
export const MORPHEME_KINDS = LexicalMorphemeKindSchema.options;

const lexicalCaseValues = [
	"Nominative",
	"Accusative",
	"Dative",
	"Genitive",
] as const;

export const LexicalCaseSchema = z.enum(lexicalCaseValues);
export type LexicalCase = z.infer<typeof LexicalCaseSchema>;

const lexicalNumberValues = ["Singular", "Plural"] as const;

export const LexicalNumberSchema = z.enum(lexicalNumberValues);
export type LexicalNumber = z.infer<typeof LexicalNumberSchema>;

const lexicalGenusValues = ["Maskulinum", "Femininum", "Neutrum"] as const;

export const LexicalGenusSchema = z.enum(lexicalGenusValues);
export type LexicalGenus = z.infer<typeof LexicalGenusSchema>;

const lexicalNounClassValues = ["Common", "Proper"] as const;

export const LexicalNounClassSchema = z.enum(lexicalNounClassValues);
export type LexicalNounClass = z.infer<typeof LexicalNounClassSchema>;

const lexicalAdjectiveClassificationValues = [
	"Qualitative",
	"Relational",
	"Participial",
] as const;

export const LexicalAdjectiveClassificationSchema = z.enum(
	lexicalAdjectiveClassificationValues,
);
export type LexicalAdjectiveClassification = z.infer<
	typeof LexicalAdjectiveClassificationSchema
>;

const lexicalAdjectiveGradabilityValues = [
	"Gradable",
	"NonGradable",
] as const;

export const LexicalAdjectiveGradabilitySchema = z.enum(
	lexicalAdjectiveGradabilityValues,
);
export type LexicalAdjectiveGradability = z.infer<
	typeof LexicalAdjectiveGradabilitySchema
>;

const lexicalAdjectiveDistributionValues = [
	"AttributiveAndPredicative",
	"AttributiveOnly",
	"PredicativeOnly",
] as const;

export const LexicalAdjectiveDistributionSchema = z.enum(
	lexicalAdjectiveDistributionValues,
);
export type LexicalAdjectiveDistribution = z.infer<
	typeof LexicalAdjectiveDistributionSchema
>;

const lexicalAdjectiveGovernedPatternValues = [
	"None",
	"Dative",
	"Accusative",
	"Genitive",
	"Prepositional",
	"ZuInfinitive",
	"DassClause",
] as const;

export const LexicalAdjectiveGovernedPatternSchema = z.enum(
	lexicalAdjectiveGovernedPatternValues,
);
export type LexicalAdjectiveGovernedPattern = z.infer<
	typeof LexicalAdjectiveGovernedPatternSchema
>;

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
export type LexicalAdjectiveValency = z.infer<
	typeof LexicalAdjectiveValencySchema
>;

const lexicalVerbConjugationValues = ["Irregular", "Regular"] as const;

export const LexicalVerbConjugationSchema = z.enum(
	lexicalVerbConjugationValues,
);
export type LexicalVerbConjugation = z.infer<
	typeof LexicalVerbConjugationSchema
>;

const lexicalVerbSeparabilityValues = [
	"Separable",
	"Inseparable",
	"None",
] as const;

export const LexicalVerbSeparabilitySchema = z.enum(
	lexicalVerbSeparabilityValues,
);
export type LexicalVerbSeparability = z.infer<
	typeof LexicalVerbSeparabilitySchema
>;

const lexicalVerbReflexivityValues = [
	"NonReflexive",
	"ReflexiveOnly",
	"OptionalReflexive",
] as const;

export const LexicalVerbReflexivitySchema = z.enum(
	lexicalVerbReflexivityValues,
);
export type LexicalVerbReflexivity = z.infer<
	typeof LexicalVerbReflexivitySchema
>;

export const LexicalVerbValencySchema = z.object({
	governedPreposition: z.string().min(1).max(30).nullable().optional(),
	reflexivity: LexicalVerbReflexivitySchema,
	separability: LexicalVerbSeparabilitySchema,
});
export type LexicalVerbValency = z.infer<typeof LexicalVerbValencySchema>;

const separabilityValues = ["Separable", "Inseparable"] as const;
export const SeparabilitySchema = z.enum(separabilityValues);
export type Separability = z.infer<typeof SeparabilitySchema>;
