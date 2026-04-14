import type {
	Case,
	Gender,
	GrammaticalNumber,
	InherentFeatures,
	MorphemeKind,
	Selection,
} from "@textfresser/linguistics";
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

type ResolvedSelectionContext = {
	contextWithLinkedParts?: string;
};

type GermanSelection = Selection<"German">;
type UnknownSelection = Extract<
	GermanSelection,
	{ orthographicStatus: "Unknown" }
>;

export type ResolvedKnownSelection = Exclude<
	GermanSelection,
	UnknownSelection
> &
	ResolvedSelectionContext;
export type ResolvedUnknownSelection = UnknownSelection &
	ResolvedSelectionContext;
export type ResolvedSelection =
	| ResolvedKnownSelection
	| ResolvedUnknownSelection;

export type LexicalMeta = {
	senseEmojis: string[];
	metaTag: string;
};

export type SenseMatchResult =
	| { kind: "matched"; cacheIndex: number }
	| { kind: "new"; precomputedSenseEmojis?: string[] };

export type LexicalInfoField<T> =
	| { status: "ready"; value: T }
	| { status: "disabled" }
	| { status: "not_applicable" }
	| { status: "error"; error: LexicalGenerationError };

export type LexicalCore = {
	senseEmojis: string[];
	ipa: string;
	senseGloss?: string;
};

export type LexicalFeatures = {
	inherentFeatures: InherentFeatures;
};

export type LexicalInflectionForm = {
	form: string;
};

export type LexemeInflections =
	| {
			kind: "noun";
			cells: Array<{
				article: string;
				case: Case;
				form: string;
				number: GrammaticalNumber;
			}>;
			gender: Gender;
	  }
	| {
			kind: "generic";
			rows: Array<{ forms: LexicalInflectionForm[]; label: string }>;
	  };

export type LexicalMorpheme = {
	isSeparable?: boolean;
	kind: MorphemeKind;
	lemma?: string;
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

export type LexicalInfo = {
	core: LexicalInfoField<LexicalCore>;
	features: LexicalInfoField<LexicalFeatures>;
	inflections: LexicalInfoField<LexemeInflections>;
	morphemicBreakdown: LexicalInfoField<MorphemicBreakdown>;
	relations: LexicalInfoField<LexicalRelations>;
	selection: ResolvedSelection;
};

export type GenerateLexicalInfoOptions = {
	precomputedSenseEmojis?: string[];
};

export type CreateLexicalGenerationModuleParams<
	TTargetLang extends TargetLanguage = TargetLanguage,
> = {
	targetLang: TTargetLang;
	knownLang: KnownLanguage;
	settings: LexicalGenerationSettings<TTargetLang>;
	fetchStructured: StructuredFetchFn;
};

export type SelectionResolver = (
	selection: string,
	attestation: string,
) => Promise<Result<ResolvedSelection, LexicalGenerationError>>;

export type SenseDisambiguator = (
	selection: ResolvedSelection,
	attestation: string,
	candidateSenses: LexicalMeta[],
) => Promise<Result<SenseMatchResult, LexicalGenerationError>>;

export type LexicalInfoGenerator = (
	selection: ResolvedSelection,
	attestation: string,
	options?: GenerateLexicalInfoOptions,
) => Promise<Result<LexicalInfo, LexicalGenerationError>>;

export type LexicalGenerationModule = {
	disambiguateSense: SenseDisambiguator;
	generateLexicalInfo: LexicalInfoGenerator;
	resolveSelection: SelectionResolver;
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
