import type {
	AnyLemma,
	AnySurface,
	LemmaKind,
	MorphemeKind,
	OrthographicStatus,
	PhrasemeKind,
	Pos,
	SurfaceKind,
} from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";

export type LemmaLingId = string;
export type SurfaceLingId = string;
export type ShallowSurfaceLingId = string;
export type LingId = LemmaLingId | SurfaceLingId;

export type LingIdSurfaceInput<L extends TargetLanguage = TargetLanguage> =
	AnySurface<L> & {
		orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
	};

export type ParsedFeatureValue = string | boolean;
export type ParsedFeatureBag = Record<string, ParsedFeatureValue>;

export type ParsedLemmaDto =
	| {
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Lexeme";
			pos: Pos;
			inherentFeatures: ParsedFeatureBag;
			meaningInEmojis?: string;
	  }
	| {
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Morpheme";
			morphemeKind: MorphemeKind;
			isClosedSet?: boolean;
			separable?: boolean;
			meaningInEmojis?: string;
	  }
	| {
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Phraseme";
			phrasemeKind: PhrasemeKind;
			meaningInEmojis?: string;
			discourseFormulaRole?: string;
	  };

export type ParsedSurfaceDto = {
	lingKind: "Surface";
	language: TargetLanguage;
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
	surfaceKind: Exclude<SurfaceKind, never>;
	normalizedFullSurface: string;
	discriminators: {
		lemmaKind: LemmaKind;
		lemmaSubKind: string;
	};
	target: { canonicalLemma: string } | { lemma: ParsedLemmaDto };
	inflectionalFeatures?: ParsedFeatureBag;
};

export type ParsedLingDto = ParsedLemmaDto | ParsedSurfaceDto;

export type ParsedLingDtoFor<L extends TargetLanguage> = ParsedLingDto & {
	language: L;
};

export type ParsedLemmaDtoFor<L extends TargetLanguage> = ParsedLemmaDto & {
	language: L;
};

export type ParsedSurfaceDtoFor<L extends TargetLanguage> = ParsedSurfaceDto & {
	language: L;
};

export type SerializableLemma = AnyLemma | ParsedLemmaDto;
export type SerializableSurface = LingIdSurfaceInput | ParsedSurfaceDto;
