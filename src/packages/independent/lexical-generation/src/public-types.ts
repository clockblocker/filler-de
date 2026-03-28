import type { Result } from "neverthrow";
import type { z } from "zod/v3";
import type {
	LexicalGenerationError,
	LexicalGenerationFailureKind,
} from "./errors";
import type {
	KnownLanguage,
	TargetLanguage,
} from "./internal/shared/languages";
import type { LexicalGenerationSettings } from "./settings";

export type ZodSchemaLike<T> = z.ZodType<T>;

export type LexicalSurfaceKind =
	| "Lemma"
	| "Inflected"
	| "Variant"
	| "Partial";

export type LexicalPos =
	| "Noun"
	| "Pronoun"
	| "Article"
	| "Adjective"
	| "Verb"
	| "Preposition"
	| "Adverb"
	| "Particle"
	| "Conjunction"
	| "InteractionalUnit";

export type LexicalPhrasemeKind =
	| "Idiom"
	| "Collocation"
	| "DiscourseFormula"
	| "Proverb"
	| "CulturalQuotation";

export type LexicalGenus = "Maskulinum" | "Femininum" | "Neutrum";

export type LexicalNounClass = "Common" | "Proper";

export type LexicalCase = "Nominative" | "Accusative" | "Dative" | "Genitive";

export type LexicalNumber = "Singular" | "Plural";

export type LexicalMorphemeKind =
	| "Root"
	| "Prefix"
	| "Suffix"
	| "Suffixoid"
	| "Circumfix"
	| "Interfix"
	| "Duplifix";

export type LexicalAdjectiveClassification =
	| "Qualitative"
	| "Relational"
	| "Participial";

export type LexicalAdjectiveDistribution =
	| "AttributiveAndPredicative"
	| "AttributiveOnly"
	| "PredicativeOnly";

export type LexicalAdjectiveGradability = "Gradable" | "NonGradable";

export type LexicalAdjectiveGovernedPattern =
	| "None"
	| "Dative"
	| "Accusative"
	| "Genitive"
	| "Prepositional"
	| "ZuInfinitive"
	| "DassClause";

export type LexicalAdjectiveValency = {
	governedPattern: LexicalAdjectiveGovernedPattern;
	governedPreposition?: string;
};

export type LexicalVerbConjugation = "Irregular" | "Regular";

export type LexicalVerbSeparability = "Separable" | "Inseparable" | "None";

export type LexicalVerbReflexivity =
	| "NonReflexive"
	| "ReflexiveOnly"
	| "OptionalReflexive";

export type LexicalVerbValency = {
	governedPreposition?: string;
	reflexivity: LexicalVerbReflexivity;
	separability: LexicalVerbSeparability;
};

export type LexicalRelationKind =
	| "Synonym"
	| "NearSynonym"
	| "Antonym"
	| "Hypernym"
	| "Hyponym"
	| "Meronym"
	| "Holonym";

export type StructuredFetchFn = <T>(params: {
	requestLabel: string;
	systemPrompt: string;
	userInput: string;
	schema: ZodSchemaLike<T>;
	withCache?: boolean;
}) => Promise<Result<T, LexicalGenerationError>>;

export type ResolvedLemma =
	| {
			linguisticUnit: "Lexem";
			lemma: string;
			posLikeKind: LexicalPos;
			surfaceKind: LexicalSurfaceKind;
			contextWithLinkedParts?: string;
	  }
	| {
			linguisticUnit: "Phrasem";
			lemma: string;
			posLikeKind: LexicalPhrasemeKind;
			surfaceKind: LexicalSurfaceKind;
			contextWithLinkedParts?: string;
	  };

export type LexicalMeta = {
	emojiDescription: string[];
	metaTag: string;
};

export type SenseMatchResult =
	| { kind: "matched"; cacheIndex: number }
	| { kind: "new"; precomputedEmojiDescription?: string[] };

export type LexicalInfoField<T> =
	| { status: "ready"; value: T }
	| { status: "disabled" }
	| { status: "not_applicable" }
	| { status: "error"; error: LexicalGenerationError };

export type LexicalNounIdentity = {
	genus?: LexicalGenus;
	nounClass?: LexicalNounClass;
};

export type LexicalCore = {
	emojiDescription: string[];
	ipa: string;
	nounIdentity?: LexicalNounIdentity;
	senseGloss?: string;
};

export type LexemFeatures =
	| {
			kind: "noun";
			genus?: LexicalGenus;
			nounClass?: LexicalNounClass;
			tags: string[];
	  }
	| {
			kind: "adjective";
			classification: LexicalAdjectiveClassification;
			distribution: LexicalAdjectiveDistribution;
			gradability: LexicalAdjectiveGradability;
			valency: LexicalAdjectiveValency;
	  }
	| {
			kind: "verb";
			conjugation: LexicalVerbConjugation;
			valency: LexicalVerbValency;
	  }
	| {
			kind: "tags";
			tags: string[];
	  };

export type PhrasemFeatures = {
	kind: "tags";
	tags: string[];
};

export type LexicalInflectionForm = {
	form: string;
};

export type LexemInflections =
	| {
			kind: "noun";
			cells: Array<{
				article: string;
				case: LexicalCase;
				form: string;
				number: LexicalNumber;
			}>;
			genus: LexicalGenus;
	  }
	| {
			kind: "generic";
			rows: Array<{ forms: LexicalInflectionForm[]; label: string }>;
	  };

export type LexicalMorpheme = {
	kind: LexicalMorphemeKind;
	lemma?: string;
	separability?: "Separable" | "Inseparable";
	surface: string;
};

export type MorphemicBreakdown = {
	compoundedFrom?: string[];
	derivedFrom?: {
		derivationType: string;
		lemma: string;
	};
	morphemes: LexicalMorpheme[];
};

export type LexicalRelations = {
	relations: Array<{
		kind: LexicalRelationKind;
		words: string[];
	}>;
};

export type LexicalInfo =
	| {
			lemma: Extract<ResolvedLemma, { linguisticUnit: "Lexem" }>;
			core: LexicalInfoField<LexicalCore>;
			features: LexicalInfoField<LexemFeatures>;
			inflections: LexicalInfoField<LexemInflections>;
			morphemicBreakdown: LexicalInfoField<MorphemicBreakdown>;
			relations: LexicalInfoField<LexicalRelations>;
	  }
	| {
			lemma: Extract<ResolvedLemma, { linguisticUnit: "Phrasem" }>;
			core: LexicalInfoField<LexicalCore>;
			features: LexicalInfoField<PhrasemFeatures>;
			inflections: LexicalInfoField<never>;
			morphemicBreakdown: LexicalInfoField<MorphemicBreakdown>;
			relations: LexicalInfoField<LexicalRelations>;
	  };

export type GenerateLexicalInfoOptions = {
	precomputedEmojiDescription?: string[];
};

export type CreateLexicalGenerationModuleParams<
	TTargetLang extends TargetLanguage = TargetLanguage,
> = {
	targetLang: TTargetLang;
	knownLang: KnownLanguage;
	settings: LexicalGenerationSettings<TTargetLang>;
	fetchStructured: StructuredFetchFn;
};

export type LemmaGenerator = (
	selection: string,
	attestation: string,
) => Promise<Result<ResolvedLemma, LexicalGenerationError>>;

export type SenseDisambiguator = (
	lemma: ResolvedLemma,
	attestation: string,
	candidateSenses: LexicalMeta[],
) => Promise<Result<SenseMatchResult, LexicalGenerationError>>;

export type LexicalInfoGenerator = (
	lemma: ResolvedLemma,
	attestation: string,
	options?: GenerateLexicalInfoOptions,
) => Promise<Result<LexicalInfo, LexicalGenerationError>>;

export type LexicalGenerationModule = {
	generateLemma: LemmaGenerator;
	disambiguateSense: SenseDisambiguator;
	generateLexicalInfo: LexicalInfoGenerator;
};

export type LexicalGenerationModuleResult = Result<
	LexicalGenerationModule,
	LexicalGenerationError
>;

export type {
	LexicalGenerationError,
	LexicalGenerationFailureKind,
	LexicalGenerationSettings,
};
