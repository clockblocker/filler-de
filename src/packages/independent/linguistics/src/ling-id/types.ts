import type { Result } from "neverthrow";
import type {
	Lemma,
	ResolvedSurface,
	Selection,
	UnresolvedSurface,
} from "../lu/public-entities";
import type { TargetLanguage } from "../lu/universal/enums/core/language";

export type ConcreteLingIdKind =
	| "Lemma"
	| "Selection"
	| "ResolvedSurface"
	| "UnresolvedSurface";

export type KnownSelection<L extends TargetLanguage = TargetLanguage> = Exclude<
	Selection<L>,
	{ orthographicStatus: "Unknown" }
>;

export type LingId<
	LIK extends ConcreteLingIdKind = ConcreteLingIdKind,
	L extends TargetLanguage = TargetLanguage,
> = string & {
	readonly __lingIdBrand: unique symbol;
	readonly __lingEntity?: LIK;
	readonly __language?: L;
};

export type LingIdValueFor<
	LIK extends ConcreteLingIdKind,
	L extends TargetLanguage,
> = LIK extends "Lemma"
	? Lemma<L>
	: LIK extends "Selection"
		? KnownSelection<L>
		: LIK extends "ResolvedSurface"
			? ResolvedSurface<L>
			: LIK extends "UnresolvedSurface"
				? UnresolvedSurface<L>
				: never;

export type LingIdDecodeErrorCode =
	| "MalformedLingId"
	| "UnsupportedVersion"
	| "UnsupportedLanguage"
	| "UnsupportedEntityKind"
	| "LanguageMismatch"
	| "EntityMismatch"
	| "PayloadDecodeFailed";

export type LingIdDecodeError = {
	code: LingIdDecodeErrorCode;
	message: string;
	input: string;
	cause?: unknown;
};

export type LingIdApiFor<L extends TargetLanguage> = {
	makeLingIdFor: {
		(value: Lemma<L>): LingId<"Lemma", L>;
		(value: KnownSelection<L>): LingId<"Selection", L>;
		(value: ResolvedSurface<L>): LingId<"ResolvedSurface", L>;
		(value: UnresolvedSurface<L>): LingId<"UnresolvedSurface", L>;
	};
	tryToDecode: (
		id: string,
	) => Result<LingIdValueFor<ConcreteLingIdKind, L>, LingIdDecodeError>;
	tryToDecodeAs: {
		(
			kind: "Lemma",
			id: string,
		): Result<Lemma<L>, LingIdDecodeError>;
		(
			kind: "Selection",
			id: string,
		): Result<KnownSelection<L>, LingIdDecodeError>;
		(
			kind: "ResolvedSurface",
			id: string,
		): Result<ResolvedSurface<L>, LingIdDecodeError>;
		(
			kind: "UnresolvedSurface",
			id: string,
		): Result<UnresolvedSurface<L>, LingIdDecodeError>;
	};
};
