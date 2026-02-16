import type { TargetLanguage } from "../../../types";
import type {
	GermanAdjectiveClassification,
	GermanAdjectiveDistribution,
	GermanAdjectiveGradability,
	GermanAdjectiveValency,
} from "../../de/lexem/adjective/features";
import type { GermanGenus, NounClass } from "../../de/lexem/noun/features";
import type {
	GermanVerbConjugation,
	GermanVerbValency,
} from "../../de/lexem/verb/features";
import type { GermanMorphemeKind } from "../../de/morphem/de-morphem-kind";
import type { Separability } from "../../de/morphem/prefix/features";
import type { LinguisticUnitKind, SurfaceKind } from "../enums/core";
import type { POS } from "../enums/linguistic-units/lexem/pos";
import type { MorphemeKind } from "../enums/linguistic-units/morphem/morpheme-kind";
import type { PhrasemeKind } from "../enums/linguistic-units/phrasem/phrasem-kind";

type EmptyFeatureSet = Record<never, never>;

type PosLikeDiscriminatorByLanguage = {
	German: {
		Lexem: POS;
		Morphem: GermanMorphemeKind;
		Phrasem: PhrasemeKind;
	};
	English: {
		Lexem: POS;
		Morphem: MorphemeKind;
		Phrasem: PhrasemeKind;
	};
};

export type PosLikeDiscriminator<
	L extends TargetLanguage,
	U extends LinguisticUnitKind,
> = PosLikeDiscriminatorByLanguage[L][U];

type GermanLexemLexicalLemma<P extends POS> = P extends "Noun"
	? {
			genus: GermanGenus;
			nounClass: NounClass;
			pos: P;
		}
	: P extends "Verb"
		? {
				conjugation: GermanVerbConjugation;
				pos: P;
				valency: GermanVerbValency;
			}
		: P extends "Adjective"
			? {
					classification: GermanAdjectiveClassification;
					distribution: GermanAdjectiveDistribution;
					gradability: GermanAdjectiveGradability;
					pos: P;
					valency: GermanAdjectiveValency;
				}
			: { pos: P };

type GermanMorphemeLexical<P extends GermanMorphemeKind> = P extends "Prefix"
	? { morphemeKind: P; separability: Separability }
	: { morphemeKind: P };

type GermanLexicalFeatureSet<
	U extends LinguisticUnitKind,
	S extends SurfaceKind,
	P extends PosLikeDiscriminator<"German", U>,
> = U extends "Lexem"
	? P extends POS
		? S extends "Lemma"
			? GermanLexemLexicalLemma<P>
			: { pos: P }
		: never
	: U extends "Phrasem"
		? P extends PhrasemeKind
			? { phrasemeKind: P }
			: never
		: U extends "Morphem"
			? P extends GermanMorphemeKind
				? GermanMorphemeLexical<P>
				: never
			: never;

type EnglishLexicalFeatureSet<
	U extends LinguisticUnitKind,
	_S extends SurfaceKind,
	P extends PosLikeDiscriminator<"English", U>,
> = U extends "Lexem"
	? P extends POS
		? { pos: P }
		: never
	: U extends "Phrasem"
		? P extends PhrasemeKind
			? { phrasemeKind: P }
			: never
		: U extends "Morphem"
			? P extends MorphemeKind
				? { morphemeKind: P }
				: never
			: never;

export type LexicalFeatureSet<
	L extends TargetLanguage,
	U extends LinguisticUnitKind,
	S extends SurfaceKind,
	P extends PosLikeDiscriminator<L, U>,
> = L extends "German"
	? GermanLexicalFeatureSet<
			U,
			S,
			Extract<P, PosLikeDiscriminator<"German", U>>
		>
	: L extends "English"
		? EnglishLexicalFeatureSet<
				U,
				S,
				Extract<P, PosLikeDiscriminator<"English", U>>
			>
		: never;

type GermanInflectionalFeatureSet<
	_U extends LinguisticUnitKind,
	_S extends SurfaceKind,
	_P,
> = EmptyFeatureSet;

type EnglishInflectionalFeatureSet<
	_U extends LinguisticUnitKind,
	_S extends SurfaceKind,
	_P,
> = EmptyFeatureSet;

export type InflectionalFeatureSet<
	L extends TargetLanguage,
	U extends LinguisticUnitKind,
	S extends SurfaceKind,
	P extends PosLikeDiscriminator<L, U>,
> = L extends "German"
	? GermanInflectionalFeatureSet<
			U,
			S,
			Extract<P, PosLikeDiscriminator<"German", U>>
		>
	: L extends "English"
		? EnglishInflectionalFeatureSet<
				U,
				S,
				Extract<P, PosLikeDiscriminator<"English", U>>
			>
		: never;

export type FeatureSet<
	L extends TargetLanguage,
	U extends LinguisticUnitKind,
	S extends SurfaceKind,
	P extends PosLikeDiscriminator<L, U>,
> = {
	inflectional: InflectionalFeatureSet<L, U, S, P>;
	lexical: LexicalFeatureSet<L, U, S, P>;
};

export type Entity<
	L extends TargetLanguage,
	U extends LinguisticUnitKind,
	S extends SurfaceKind,
	P extends PosLikeDiscriminator<L, U>,
> = {
	emojiDescription: string[];
	features: FeatureSet<L, U, S, P>;
	ipa: string;
	language: L;
	lemma: string;
	linguisticUnit: U;
	posLikeKind: P;
	surface?: string;
	surfaceKind: S;
};

export type DePosLikeDiscriminator<U extends LinguisticUnitKind> =
	PosLikeDiscriminator<"German", U>;
export type EnPosLikeDiscriminator<U extends LinguisticUnitKind> =
	PosLikeDiscriminator<"English", U>;
export type EngPosLikeDiscriminator<U extends LinguisticUnitKind> =
	EnPosLikeDiscriminator<U>;

export type DeEntity<
	U extends LinguisticUnitKind = LinguisticUnitKind,
	S extends SurfaceKind = SurfaceKind,
> = U extends LinguisticUnitKind
	? Entity<"German", U, S, DePosLikeDiscriminator<U>>
	: never;

export type EnEntity<
	U extends LinguisticUnitKind = LinguisticUnitKind,
	S extends SurfaceKind = SurfaceKind,
> = U extends LinguisticUnitKind
	? Entity<"English", U, S, EnPosLikeDiscriminator<U>>
	: never;

export type EngEntity<
	U extends LinguisticUnitKind = LinguisticUnitKind,
	S extends SurfaceKind = SurfaceKind,
> = EnEntity<U, S>;
