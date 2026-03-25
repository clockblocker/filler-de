import type { Result } from "neverthrow";
import type { z } from "zod/v3";
import type { PhrasemeKind } from "../linguistics/common/enums/linguistic-units/phrasem/phrasem-kind";
import type { DeLexemPos } from "../linguistics/de/lemma";
import type {
	GermanAdjectiveClassification,
	GermanAdjectiveDistribution,
	GermanAdjectiveGradability,
	GermanAdjectiveValency,
} from "../linguistics/de/lexem/adjective/features";
import type {
	GermanGenus,
	NounClass,
	NounInflectionCell,
} from "../linguistics/de/lexem/noun/features";
import type {
	GermanVerbConjugation,
	GermanVerbValency,
} from "../linguistics/de/lexem/verb/features";
import type { LlmMorpheme } from "../prompt-smith/schemas/morphem";
import type { RelationSubKind } from "../prompt-smith/schemas/relation";
import type { KnownLanguage, TargetLanguage } from "../types";
import type {
	LexicalGenerationError,
	LexicalGenerationFailureKind,
} from "./errors";
import type { LexicalGenerationSettings } from "./settings";

export type ZodSchemaLike<T> = z.ZodType<T>;

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
			posLikeKind: DeLexemPos;
			surfaceKind: "Lemma" | "Inflected" | "Variant";
			contextWithLinkedParts?: string;
	  }
	| {
			linguisticUnit: "Phrasem";
			lemma: string;
			posLikeKind: PhrasemeKind;
			surfaceKind: "Lemma" | "Inflected" | "Variant";
			contextWithLinkedParts?: string;
	  };

export type CandidateSense =
	| {
			id: string;
			linguisticUnit: "Lexem";
			posLikeKind: DeLexemPos;
			emojiDescription?: string[];
			genus?: GermanGenus;
			ipa?: string;
			senseGloss?: string;
	  }
	| {
			id: string;
			linguisticUnit: "Phrasem";
			posLikeKind: PhrasemeKind;
			emojiDescription?: string[];
			ipa?: string;
			senseGloss?: string;
	  };

export type SenseMatchResult =
	| { kind: "matched"; senseId: string }
	| { kind: "new"; precomputedEmojiDescription?: string[] };

export type LexicalInfoField<T> =
	| { status: "ready"; value: T }
	| { status: "disabled" }
	| { status: "not_applicable" }
	| { status: "error"; error: LexicalGenerationError };

export type LexicalCore = {
	emojiDescription: string[];
	ipa: string;
	senseGloss?: string;
};

export type LexemFeatures =
	| {
			kind: "noun";
			genus?: GermanGenus;
			nounClass?: NounClass;
			tags: string[];
	  }
	| {
			kind: "adjective";
			classification: GermanAdjectiveClassification;
			distribution: GermanAdjectiveDistribution;
			gradability: GermanAdjectiveGradability;
			valency: GermanAdjectiveValency;
	  }
	| {
			kind: "verb";
			conjugation: GermanVerbConjugation;
			valency: GermanVerbValency;
	  }
	| {
			kind: "tags";
			tags: string[];
	  };

export type PhrasemFeatures = {
	kind: "tags";
	tags: string[];
};

export type LexemInflections =
	| {
			kind: "noun";
			cells: NounInflectionCell[];
			genus: GermanGenus;
	  }
	| {
			kind: "generic";
			rows: Array<{ forms: string; label: string }>;
	  };

export type MorphemicBreakdown = {
	compoundedFrom?: string[];
	derivedFrom?: {
		derivationType: string;
		lemma: string;
	};
	morphemes: LlmMorpheme[];
};

export type LexicalRelations = {
	relations: Array<{
		kind: RelationSubKind;
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
	candidateSenses: CandidateSense[],
) => Promise<Result<SenseMatchResult, LexicalGenerationError>>;

export type LexicalInfoGenerator = (
	lemma: ResolvedLemma,
	attestation: string,
	options?: GenerateLexicalInfoOptions,
) => Promise<Result<LexicalInfo, LexicalGenerationError>>;

export type LexicalGenerationModule = {
	buildLemmaGenerator(): LemmaGenerator;
	buildSenseDisambiguator(): SenseDisambiguator;
	buildLexicalInfoGenerator(): LexicalInfoGenerator;
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
