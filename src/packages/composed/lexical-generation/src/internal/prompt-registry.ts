import {
	Case,
	Gender,
	GrammaticalNumber,
	type InherentFeatures,
	LemmaSchema,
	MorphemeKind,
	PhrasemeKind,
	Pos,
} from "@textfresser/linguistics";
import { z } from "zod/v3";
import type { LexicalRelationKind } from "../public-types";

export type PromptSpec<TInput, TOutput> = {
	inputSchema: z.ZodType<TInput>;
	outputSchema: z.ZodType<TOutput>;
	requestLabel: string;
	systemPrompt: string;
};

export type ResolveSelectionPromptInput = {
	attestation: string;
	selection: string;
};

export type ResolveSelectionPromptOutput = {
	contextWithLinkedParts?: string;
	discriminator?: Pos | PhrasemeKind | MorphemeKind | null;
	lemmaKind?: "Lexeme" | "Phraseme" | "Morpheme" | null;
	orthographicStatus?: "Standard" | "Typo" | "Unknown";
	spelledLemma?: string | null;
	surfaceKind?: "Lemma" | "Inflection" | "Variant" | "Partial" | null;
};

export type DisambiguationPromptInput = {
	attestation: string;
	lemma: string;
	senses: Array<{
		senseEmojis: string[];
		identity: {
			discriminator: Pos | PhrasemeKind | MorphemeKind;
			lemmaKind: "Lexeme" | "Phraseme" | "Morpheme";
			surfaceKind: "Lemma" | "Inflection" | "Variant" | "Partial";
		};
		index: number;
	}>;
};

export type DisambiguationPromptOutput = {
	senseEmojis?: string[] | null;
	matchedIndex: number | null;
};

export type CorePromptInput = {
	attestation: string;
	discriminator?: string;
	lemma: string;
};

export type CorePromptOutput = {
	senseEmojis: string[];
	ipa: string;
	senseGloss?: string | null;
};

export type FeaturesPromptInput = {
	attestation: string;
	lemma: string;
	pos: Pos;
};

export type FeaturesPromptOutput = {
	inherentFeatures: InherentFeatures;
};

export type GenericInflectionsPromptOutput = {
	rows: Array<{
		forms: string[];
		label: string;
	}>;
};

export type NounInflectionsPromptOutput = {
	cells: Array<{
		article: string;
		case: Case;
		form: string;
		number: GrammaticalNumber;
	}>;
	gender?: Gender | null;
};

export type MorphemicBreakdownPromptOutput = {
	compoundedFrom?: string[] | null;
	derivedFrom?: {
		derivationType: string;
		lemma: string;
	} | null;
	morphemes: Array<{
		isSeparable?: boolean | null;
		kind: MorphemeKind;
		lemma?: string | null;
		surface: string;
	}>;
};

export type RelationsPromptOutput = {
	relations: Array<{
		kind: LexicalRelationKind;
		words: string[];
	}>;
};

const CaseSchema = z.nativeEnum(Case);
const GenderSchema = z.nativeEnum(Gender);
const GrammaticalNumberSchema = z.nativeEnum(GrammaticalNumber);
const MorphemeKindSchema = z.nativeEnum(MorphemeKind);
const PhrasemeKindSchema = z.nativeEnum(PhrasemeKind);
const PosSchema = z.nativeEnum(Pos);
const NativeDiscriminatorSchema = z.union([
	PosSchema,
	PhrasemeKindSchema,
	MorphemeKindSchema,
]);

function getObjectFieldSchema(
	schema: z.ZodTypeAny,
	field: string,
): z.ZodTypeAny {
	const shape = (schema as z.AnyZodObject).shape;
	return shape[field] as z.ZodTypeAny;
}

const germanInherentFeaturesSchemaByPos = {
	ADJ: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.ADJ,
		"inherentFeatures",
	),
	ADP: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.ADP,
		"inherentFeatures",
	),
	ADV: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.ADV,
		"inherentFeatures",
	),
	AUX: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.AUX,
		"inherentFeatures",
	),
	CCONJ: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.CCONJ,
		"inherentFeatures",
	),
	DET: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.DET,
		"inherentFeatures",
	),
	INTJ: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.INTJ,
		"inherentFeatures",
	),
	NOUN: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.NOUN,
		"inherentFeatures",
	),
	NUM: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.NUM,
		"inherentFeatures",
	),
	PART: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.PART,
		"inherentFeatures",
	),
	PRON: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.PRON,
		"inherentFeatures",
	),
	PROPN: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.PROPN,
		"inherentFeatures",
	),
	PUNCT: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.PUNCT,
		"inherentFeatures",
	),
	SCONJ: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.SCONJ,
		"inherentFeatures",
	),
	SYM: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.SYM,
		"inherentFeatures",
	),
	VERB: getObjectFieldSchema(
		LemmaSchema.German.Lexeme.VERB,
		"inherentFeatures",
	),
	X: getObjectFieldSchema(LemmaSchema.German.Lexeme.X, "inherentFeatures"),
} satisfies Record<Pos, z.ZodTypeAny>;

const resolveSelectionPrompt: PromptSpec<
	ResolveSelectionPromptInput,
	ResolveSelectionPromptOutput
> = {
	inputSchema: z
		.object({
			attestation: z.string(),
			selection: z.string(),
		})
		.strict(),
	outputSchema: z
		.object({
			contextWithLinkedParts: z.string().optional(),
			discriminator: NativeDiscriminatorSchema.nullable().optional(),
			lemmaKind: z
				.enum(["Lexeme", "Phraseme", "Morpheme"])
				.nullable()
				.optional(),
			orthographicStatus: z
				.enum(["Standard", "Typo", "Unknown"])
				.optional()
				.default("Standard"),
			spelledLemma: z.string().nullable().optional(),
			surfaceKind: z
				.enum(["Lemma", "Inflection", "Variant", "Partial"])
				.nullable()
				.optional(),
		})
		.strict(),
	requestLabel: "ResolveSelection",
	systemPrompt:
		"Resolve the selected German surface to native lemma-kind, discriminator, and surface-kind fields.",
};

const disambiguationPrompt: PromptSpec<
	DisambiguationPromptInput,
	DisambiguationPromptOutput
> = {
	inputSchema: z
		.object({
			attestation: z.string(),
			lemma: z.string(),
			senses: z.array(
				z.object({
					senseEmojis: z.array(z.string()),
					identity: z.object({
						discriminator: NativeDiscriminatorSchema,
						lemmaKind: z.enum(["Lexeme", "Phraseme", "Morpheme"]),
						surfaceKind: z.enum([
							"Lemma",
							"Inflection",
							"Variant",
							"Partial",
						]),
					}),
					index: z.number().int().positive(),
				}),
			),
		})
		.strict(),
	outputSchema: z
		.object({
			senseEmojis: z.array(z.string()).nullable().optional(),
			matchedIndex: z.number().int().positive().nullable(),
		})
		.strict(),
	requestLabel: "DisambiguateSense",
	systemPrompt:
		"Match the attested German lemma against structured candidate senses and return the best index or a fresh emoji description.",
};

const corePromptOutputSchema = z
	.object({
		senseEmojis: z.array(z.string()),
		ipa: z.string(),
		senseGloss: z.string().nullable().optional(),
	})
	.strict();

const corePromptInputSchema = z
	.object({
		attestation: z.string(),
		discriminator: z.string().optional(),
		lemma: z.string(),
	})
	.strict();

const featuresPromptInputSchema = z
	.object({
		attestation: z.string(),
		lemma: z.string(),
		pos: PosSchema,
	})
	.strict();

const genericInflectionsPromptOutputSchema = z
	.object({
		rows: z.array(
			z.object({
				forms: z.array(z.string()),
				label: z.string(),
			}),
		),
	})
	.strict();

const nounInflectionsPromptOutputSchema = z
	.object({
		cells: z.array(
			z.object({
				article: z.string(),
				case: CaseSchema,
				form: z.string(),
				number: GrammaticalNumberSchema,
			}),
		),
		gender: GenderSchema.nullable().optional(),
	})
	.strict();

const morphemicBreakdownPromptOutputSchema = z
	.object({
		compoundedFrom: z.array(z.string()).nullable().optional(),
		derivedFrom: z
			.object({
				derivationType: z.string(),
				lemma: z.string(),
			})
			.nullable()
			.optional(),
		morphemes: z.array(
			z.object({
				isSeparable: z.boolean().nullable().optional(),
				kind: MorphemeKindSchema,
				lemma: z.string().nullable().optional(),
				surface: z.string(),
			}),
		),
	})
	.strict();

const relationsPromptOutputSchema = z
	.object({
		relations: z.array(
			z.object({
				kind: z.enum([
					"Synonym",
					"NearSynonym",
					"Antonym",
					"Hypernym",
					"Hyponym",
					"Meronym",
					"Holonym",
				]),
				words: z.array(z.string()),
			}),
		),
	})
	.strict();

function createCorePrompt(requestLabel: string, systemPrompt: string) {
	return {
		inputSchema: corePromptInputSchema,
		outputSchema: corePromptOutputSchema,
		requestLabel,
		systemPrompt,
	} satisfies PromptSpec<CorePromptInput, CorePromptOutput>;
}

function createFeaturesPromptWithSchema(
	requestLabel: string,
	systemPrompt: string,
	inherentFeaturesSchema: z.ZodTypeAny,
) {
	return {
		inputSchema: featuresPromptInputSchema,
		outputSchema: z
			.object({
				inherentFeatures: inherentFeaturesSchema,
			})
			.strict() as z.ZodType<FeaturesPromptOutput>,
		requestLabel,
		systemPrompt,
	} satisfies PromptSpec<FeaturesPromptInput, FeaturesPromptOutput>;
}

export const operationRegistry = {
	core: {
		lexeme: createCorePrompt(
			"GenerateCoreLexeme",
			"Generate core lexical info for a German lexeme.",
		),
		noun: createCorePrompt(
			"GenerateCoreNoun",
			"Generate core lexical info for a German noun or proper noun.",
		),
		phraseme: createCorePrompt(
			"GenerateCorePhraseme",
			"Generate core lexical info for a German phraseme.",
		),
	},
	disambiguateSense: disambiguationPrompt,
	featuresByPos: {
		ADJ: createFeaturesPromptWithSchema(
			"GenerateFeaturesAdjective",
			"Generate native inherent features for a German adjective.",
			germanInherentFeaturesSchemaByPos.ADJ,
		),
		ADP: createFeaturesPromptWithSchema(
			"GenerateFeaturesPreposition",
			"Generate native inherent features for a German adposition.",
			germanInherentFeaturesSchemaByPos.ADP,
		),
		ADV: createFeaturesPromptWithSchema(
			"GenerateFeaturesAdverb",
			"Generate native inherent features for a German adverb.",
			germanInherentFeaturesSchemaByPos.ADV,
		),
		AUX: createFeaturesPromptWithSchema(
			"GenerateFeaturesVerb",
			"Generate native inherent features for a German auxiliary.",
			germanInherentFeaturesSchemaByPos.AUX,
		),
		CCONJ: createFeaturesPromptWithSchema(
			"GenerateFeaturesConjunction",
			"Generate native inherent features for a German coordinating conjunction.",
			germanInherentFeaturesSchemaByPos.CCONJ,
		),
		DET: createFeaturesPromptWithSchema(
			"GenerateFeaturesArticle",
			"Generate native inherent features for a German determiner.",
			germanInherentFeaturesSchemaByPos.DET,
		),
		INTJ: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German interactional unit.",
			germanInherentFeaturesSchemaByPos.INTJ,
		),
		NOUN: createFeaturesPromptWithSchema(
			"GenerateFeaturesNoun",
			"Generate native inherent features for a German noun.",
			germanInherentFeaturesSchemaByPos.NOUN,
		),
		NUM: createFeaturesPromptWithSchema(
			"GenerateFeaturesNoun",
			"Generate native inherent features for a German numeral.",
			germanInherentFeaturesSchemaByPos.NUM,
		),
		PART: createFeaturesPromptWithSchema(
			"GenerateFeaturesParticle",
			"Generate native inherent features for a German particle.",
			germanInherentFeaturesSchemaByPos.PART,
		),
		PRON: createFeaturesPromptWithSchema(
			"GenerateFeaturesPronoun",
			"Generate native inherent features for a German pronoun.",
			germanInherentFeaturesSchemaByPos.PRON,
		),
		PROPN: createFeaturesPromptWithSchema(
			"GenerateFeaturesNoun",
			"Generate native inherent features for a German proper noun.",
			germanInherentFeaturesSchemaByPos.PROPN,
		),
		PUNCT: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German punctuation token.",
			germanInherentFeaturesSchemaByPos.PUNCT,
		),
		SCONJ: createFeaturesPromptWithSchema(
			"GenerateFeaturesConjunction",
			"Generate native inherent features for a German subordinating conjunction.",
			germanInherentFeaturesSchemaByPos.SCONJ,
		),
		SYM: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German symbol.",
			germanInherentFeaturesSchemaByPos.SYM,
		),
		VERB: createFeaturesPromptWithSchema(
			"GenerateFeaturesVerb",
			"Generate native inherent features for a German verb.",
			germanInherentFeaturesSchemaByPos.VERB,
		),
		X: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German other token.",
			germanInherentFeaturesSchemaByPos.X,
		),
	} satisfies Record<
		Pos,
		PromptSpec<FeaturesPromptInput, FeaturesPromptOutput>
	>,
	genericInflections: {
		inputSchema: corePromptInputSchema,
		outputSchema: genericInflectionsPromptOutputSchema,
		requestLabel: "GenerateInflectionsGeneric",
		systemPrompt:
			"Generate generic inflection tables for a German lexeme in native row form.",
	} satisfies PromptSpec<CorePromptInput, GenericInflectionsPromptOutput>,
	morphemicBreakdown: {
		inputSchema: corePromptInputSchema,
		outputSchema: morphemicBreakdownPromptOutputSchema,
		requestLabel: "GenerateMorphemicBreakdown",
		systemPrompt:
			"Generate a morphemic breakdown for a German lemma using native structure.",
	} satisfies PromptSpec<CorePromptInput, MorphemicBreakdownPromptOutput>,
	nounInflections: {
		inputSchema: corePromptInputSchema,
		outputSchema: nounInflectionsPromptOutputSchema,
		requestLabel: "GenerateInflectionsNoun",
		systemPrompt:
			"Generate noun inflection cells for a German noun in native case/number form.",
	} satisfies PromptSpec<CorePromptInput, NounInflectionsPromptOutput>,
	relations: {
		inputSchema: corePromptInputSchema,
		outputSchema: relationsPromptOutputSchema,
		requestLabel: "GenerateRelations",
		systemPrompt:
			"Generate lexical relations for a German lemma using native relation kinds.",
	} satisfies PromptSpec<CorePromptInput, RelationsPromptOutput>,
	resolveSelection: resolveSelectionPrompt,
};

export function getRequiredPromptSpecs() {
	return [
		operationRegistry.resolveSelection,
		operationRegistry.disambiguateSense,
		operationRegistry.core.lexeme,
		operationRegistry.core.noun,
		operationRegistry.core.phraseme,
		operationRegistry.genericInflections,
		operationRegistry.nounInflections,
		operationRegistry.morphemicBreakdown,
		operationRegistry.relations,
		...Object.values(operationRegistry.featuresByPos),
	];
}
