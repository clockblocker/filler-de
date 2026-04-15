import type { Lemma, ResolvedSurface, Selection } from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import type { OrthographicStatus } from "../lu/universal/enums/core/selection";

export type ResolvedSurfaceLingId = string;
export type SurfaceLingId = string;
export type ShallowSurfaceLingId = string;
export type LingId = SurfaceLingId | ResolvedSurfaceLingId;

type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

export type LingIdSelection<L extends TargetLanguage = TargetLanguage> =
	Selection<L, KnownOrthographicStatus>;

export type LingIdResolvedSurface<L extends TargetLanguage = TargetLanguage> =
	Extract<ResolvedSurface, { surfaceKind: "Lemma"; target: Lemma<L> }>;

export type LingIdSurfaceInput<L extends TargetLanguage = TargetLanguage> =
	LingIdSelection<L>;

export type ParsedSurfaceResult<L extends TargetLanguage = TargetLanguage> =
	| LingIdSelection<L>
	| LingIdResolvedSurface<L>;

export type ParsedFeatureValue = string | boolean | readonly string[];
export type ParsedFeatureBag = Record<string, ParsedFeatureValue>;

export type ParsedShallowSurfaceDto = {
	language: TargetLanguage;
	orthographicStatus: KnownOrthographicStatus;
	surface: {
		normalizedFullSurface: string;
		surfaceKind: "Lemma" | "Inflection" | "Variant";
		discriminators: {
			lemmaKind: "Lexeme" | "Morpheme" | "Phraseme";
			lemmaSubKind: string;
		};
		inflectionalFeatures?: ParsedFeatureBag;
	};
	target?: never;
};

export type ParsedShallowSurfaceDtoFor<L extends TargetLanguage> =
	ParsedShallowSurfaceDto & {
		language: L;
	};

export type SerializableLemma = Lemma;
export type SerializableSurface = LingIdSelection | LingIdResolvedSurface;
export type SerializableSurfaceShell =
	| SerializableSurface
	| ParsedShallowSurfaceDto;
