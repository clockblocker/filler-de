import type {
	MorphemeKind,
	PhrasemeKind,
	Pos,
} from "@textfresser/linguistics";
import { GermanAdjectiveInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/adjective/parts/german-adjective-features";
import { GermanAdpositionInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/adposition/parts/german-adposition-features";
import { GermanAdverbInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/adverb/parts/german-adverb-features";
import { GermanAuxiliaryInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/auxiliary/parts/german-auxiliary-features";
import { GermanCoordinatingConjunctionInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/coordinating-conjunction/parts/german-coordinating-conjunction-features";
import { GermanDeterminerInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/determiner/parts/german-determiner-features";
import { GermanInterjectionInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/interjection/parts/german-interjection-features";
import { GermanNounInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/noun/parts/german-noun-features";
import { GermanNumeralInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/numeral/parts/german-numeral-features";
import { GermanOtherInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/other/parts/german-other-features";
import { GermanParticleInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/particle/parts/german-particle-features";
import { GermanPronounInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/pronoun/parts/german-pronoun-features";
import { GermanProperNounInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/proper-noun/parts/german-proper-noun-features";
import { GermanPunctuationInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/punctuation/parts/german-punctuation-features";
import { GermanSubordinatingConjunctionInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/subordinating-conjunction/parts/german-subordinating-conjunction-features";
import { GermanSymbolInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/symbol/parts/german-symbol-features";
import { GermanVerbInherentFeaturesSchema } from "../../../../independent/linguistics/src/german/lu/lexeme/verb/parts/german-verb-features";
import { MorphemeKindSchema } from "../../../../independent/linguistics/src/universal/enums/kind/morpheme-kind";
import { PhrasemeKind as PhrasemeKindSchema } from "../../../../independent/linguistics/src/universal/enums/kind/phraseme-kind";
import { Pos as PosSchema } from "../../../../independent/linguistics/src/universal/enums/kind/pos";
import { Case as CaseSchema } from "../../../../independent/linguistics/src/universal/enums/feature/ud/case";
import { Gender as GenderSchema } from "../../../../independent/linguistics/src/universal/enums/feature/ud/gender";
import { GrammaticalNumber as GrammaticalNumberSchema } from "../../../../independent/linguistics/src/universal/enums/feature/ud/number";
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
		emojiDescription: string[];
		identity: {
			discriminator: string;
			lemmaKind: string;
			surfaceKind: string;
		};
		index: number;
	}>;
};

export type DisambiguationPromptOutput = {
	emojiDescription?: string[] | null;
	matchedIndex: number | null;
};

export type CorePromptInput = {
	attestation: string;
	discriminator?: string;
	lemma: string;
};

export type CorePromptOutput = {
	emojiDescription: string[];
	ipa: string;
	senseGloss?: string | null;
};

export type FeaturesPromptInput = {
	attestation: string;
	lemma: string;
	pos: Pos;
};

export type FeaturesPromptOutput = {
	inherentFeatures: Record<string, unknown>;
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
		case: z.infer<typeof CaseSchema>;
		form: string;
		number: z.infer<typeof GrammaticalNumberSchema>;
	}>;
	gender?: z.infer<typeof GenderSchema> | null;
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

const nativeDiscriminatorSchema = z.union([
	PosSchema,
	PhrasemeKindSchema,
	MorphemeKindSchema,
]);

export type RelationsPromptOutput = {
	relations: Array<{
		kind: LexicalRelationKind;
		words: string[];
	}>;
};

const resolveSelectionPrompt: PromptSpec<
	ResolveSelectionPromptInput,
	ResolveSelectionPromptOutput
> = {
	inputSchema: z.object({
		attestation: z.string(),
		selection: z.string(),
	}).strict(),
	outputSchema: z.object({
		contextWithLinkedParts: z.string().optional(),
		discriminator: nativeDiscriminatorSchema.nullable().optional(),
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
	}).strict(),
	requestLabel: "ResolveSelection",
	systemPrompt:
		"Resolve the selected German surface to native lemma-kind, discriminator, and surface-kind fields.",
};

const disambiguationPrompt: PromptSpec<
	DisambiguationPromptInput,
	DisambiguationPromptOutput
> = {
	inputSchema: z.object({
		attestation: z.string(),
		lemma: z.string(),
		senses: z.array(
			z.object({
				emojiDescription: z.array(z.string()),
				identity: z.object({
					discriminator: z.string(),
					lemmaKind: z.string(),
					surfaceKind: z.string(),
				}),
				index: z.number().int().positive(),
			}),
		),
	}).strict(),
	outputSchema: z.object({
		emojiDescription: z.array(z.string()).nullable().optional(),
		matchedIndex: z.number().int().positive().nullable(),
	}).strict(),
	requestLabel: "DisambiguateSense",
	systemPrompt:
		"Match the attested German lemma against structured candidate senses and return the best index or a fresh emoji description.",
};

const corePromptOutputSchema = z.object({
	emojiDescription: z.array(z.string()),
	ipa: z.string(),
	senseGloss: z.string().nullable().optional(),
}).strict();

const corePromptInputSchema = z.object({
	attestation: z.string(),
	discriminator: z.string().optional(),
	lemma: z.string(),
}).strict();

const featuresPromptInputSchema = z.object({
	attestation: z.string(),
	lemma: z.string(),
	pos: PosSchema,
}).strict();

const genericInflectionsPromptOutputSchema = z.object({
	rows: z.array(
		z.object({
			forms: z.array(z.string()),
			label: z.string(),
		}),
	),
}).strict();

const nounInflectionsPromptOutputSchema = z.object({
	cells: z.array(
		z.object({
			article: z.string(),
			case: CaseSchema,
			form: z.string(),
			number: GrammaticalNumberSchema,
		}),
	),
	gender: GenderSchema.nullable().optional(),
}).strict();

const morphemicBreakdownPromptOutputSchema = z.object({
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
}).strict();

const relationsPromptOutputSchema = z.object({
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
}).strict();

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
			.strict(),
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
			GermanAdjectiveInherentFeaturesSchema,
		),
		ADP: createFeaturesPromptWithSchema(
			"GenerateFeaturesPreposition",
			"Generate native inherent features for a German adposition.",
			GermanAdpositionInherentFeaturesSchema,
		),
		ADV: createFeaturesPromptWithSchema(
			"GenerateFeaturesAdverb",
			"Generate native inherent features for a German adverb.",
			GermanAdverbInherentFeaturesSchema,
		),
		AUX: createFeaturesPromptWithSchema(
			"GenerateFeaturesVerb",
			"Generate native inherent features for a German auxiliary.",
			GermanAuxiliaryInherentFeaturesSchema,
		),
		CCONJ: createFeaturesPromptWithSchema(
			"GenerateFeaturesConjunction",
			"Generate native inherent features for a German coordinating conjunction.",
			GermanCoordinatingConjunctionInherentFeaturesSchema,
		),
		DET: createFeaturesPromptWithSchema(
			"GenerateFeaturesArticle",
			"Generate native inherent features for a German determiner.",
			GermanDeterminerInherentFeaturesSchema,
		),
		INTJ: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German interactional unit.",
			GermanInterjectionInherentFeaturesSchema,
		),
		NOUN: createFeaturesPromptWithSchema(
			"GenerateFeaturesNoun",
			"Generate native inherent features for a German noun.",
			GermanNounInherentFeaturesSchema,
		),
		NUM: createFeaturesPromptWithSchema(
			"GenerateFeaturesNoun",
			"Generate native inherent features for a German numeral.",
			GermanNumeralInherentFeaturesSchema,
		),
		PART: createFeaturesPromptWithSchema(
			"GenerateFeaturesParticle",
			"Generate native inherent features for a German particle.",
			GermanParticleInherentFeaturesSchema,
		),
		PRON: createFeaturesPromptWithSchema(
			"GenerateFeaturesPronoun",
			"Generate native inherent features for a German pronoun.",
			GermanPronounInherentFeaturesSchema,
		),
		PROPN: createFeaturesPromptWithSchema(
			"GenerateFeaturesNoun",
			"Generate native inherent features for a German proper noun.",
			GermanProperNounInherentFeaturesSchema,
		),
		PUNCT: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German punctuation token.",
			GermanPunctuationInherentFeaturesSchema,
		),
		SCONJ: createFeaturesPromptWithSchema(
			"GenerateFeaturesConjunction",
			"Generate native inherent features for a German subordinating conjunction.",
			GermanSubordinatingConjunctionInherentFeaturesSchema,
		),
		SYM: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German symbol.",
			GermanSymbolInherentFeaturesSchema,
		),
		VERB: createFeaturesPromptWithSchema(
			"GenerateFeaturesVerb",
			"Generate native inherent features for a German verb.",
			GermanVerbInherentFeaturesSchema,
		),
		X: createFeaturesPromptWithSchema(
			"GenerateFeaturesInteractionalUnit",
			"Generate native inherent features for a German other token.",
			GermanOtherInherentFeaturesSchema,
		),
	} satisfies Record<Pos, PromptSpec<FeaturesPromptInput, FeaturesPromptOutput>>,
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
