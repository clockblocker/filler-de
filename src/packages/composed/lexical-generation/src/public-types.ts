import type {
	AnySelection,
	Case,
	Gender,
	GrammaticalNumber,
	InherentFeatures,
	LemmaKind,
	MorphemeKind,
	PhrasemeKind,
	Pos,
	SurfaceKind,
	UnknownSelection,
} from "@textfresser/linguistics";
import type { Result } from "neverthrow";
import type { z } from "zod/v3";
import type {
	LexicalGenerationError,
	LexicalGenerationFailureKind,
} from "./errors";
import type { KnownLanguage, TargetLanguage } from "./internal/languages";
import type { LexicalGenerationSettings } from "./settings";

export type ZodSchemaLike<T> = z.ZodType<T>;

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

export type ResolvedKnownSelection = Exclude<
	AnySelection<"German">,
	UnknownSelection
> &
	ResolvedSelectionContext;
export type ResolvedUnknownSelection = UnknownSelection &
	ResolvedSelectionContext;
export type ResolvedSelection =
	| ResolvedKnownSelection
	| ResolvedUnknownSelection;

export type LexicalDiscriminator = Pos | PhrasemeKind | MorphemeKind;

export type LexicalIdentity = {
	discriminator: LexicalDiscriminator;
	lemmaKind: LemmaKind;
	surfaceKind: SurfaceKind;
};

export type LexicalMeta = {
	emojiDescription: string[];
	identity: LexicalIdentity;
};

export type SenseMatchResult =
	| { kind: "matched"; cacheIndex: number }
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
			gender?: Gender;
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

export type LexicalRelationKind =
	| "Synonym"
	| "NearSynonym"
	| "Antonym"
	| "Hypernym"
	| "Hyponym"
	| "Meronym"
	| "Holonym";

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

export type LexicalInfoPart =
	| "core"
	| "features"
	| "inflections"
	| "morphemicBreakdown"
	| "relations";

export type GenerateCoreOptions = {
	precomputedEmojiDescription?: string[];
};

export type GenerateLexicalInfoOptions = GenerateCoreOptions & {
	disabledParts?: Partial<Record<LexicalInfoPart, boolean>>;
};

export type CreateLexicalGenerationClientParams<
	TTargetLanguage extends TargetLanguage = TargetLanguage,
> = {
	targetLanguage: TTargetLanguage;
	knownLanguage: KnownLanguage;
	settings: LexicalGenerationSettings;
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

export type CoreGenerator = (
	selection: ResolvedSelection,
	attestation: string,
	options?: GenerateCoreOptions,
) => Promise<Result<LexicalInfoField<LexicalCore>, LexicalGenerationError>>;

export type FeaturesGenerator = (
	selection: ResolvedSelection,
	attestation: string,
) => Promise<Result<LexicalInfoField<LexicalFeatures>, LexicalGenerationError>>;

export type InflectionsGenerator = (
	selection: ResolvedSelection,
	attestation: string,
) => Promise<Result<LexicalInfoField<LexemeInflections>, LexicalGenerationError>>;

export type MorphemicBreakdownGenerator = (
	selection: ResolvedSelection,
	attestation: string,
) => Promise<Result<LexicalInfoField<MorphemicBreakdown>, LexicalGenerationError>>;

export type RelationsGenerator = (
	selection: ResolvedSelection,
	attestation: string,
) => Promise<Result<LexicalInfoField<LexicalRelations>, LexicalGenerationError>>;

export type LexicalInfoGenerator = (
	selection: ResolvedSelection,
	attestation: string,
	options?: GenerateLexicalInfoOptions,
) => Promise<Result<LexicalInfo, LexicalGenerationError>>;

export type LexicalGenerationClient = {
	resolveSelection: SelectionResolver;
	disambiguateSense: SenseDisambiguator;
	generateLexicalInfo: LexicalInfoGenerator;
	generateCore: CoreGenerator;
	generateFeatures: FeaturesGenerator;
	generateInflections: InflectionsGenerator;
	generateMorphemicBreakdown: MorphemicBreakdownGenerator;
	generateRelations: RelationsGenerator;
};

export type LexicalGenerationClientResult = Result<
	LexicalGenerationClient,
	LexicalGenerationError
>;

export type {
	LexicalGenerationError,
	LexicalGenerationFailureKind,
	LexicalGenerationSettings,
};
