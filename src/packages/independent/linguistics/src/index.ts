import type z from "zod/v3";
import type { ZodTypeAny } from "zod/v3";
import { EnglishLemmaSchema } from "./english/english-lemma";
import { EnglishSelectionSchema } from "./english/english-selection";
import { GermanLemmaSchema } from "./german/german-lemma";
import { GermanSelectionSchema } from "./german/german-selection";
import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "./registry-shapes";
import type { AbstractLemma } from "./universal/abstract-lemma";
import type { AbstractSelectionFor } from "./universal/abstract-selection";
import type {
	TargetLanguage,
	TargetLanguageSchema,
} from "./universal/enums/core/language";
import {
	LemmaKind as LemmaKindSchema,
	OrthographicStatus as OrthographicStatusSchema,
	SurfaceKind as SurfaceKindSchema,
} from "./universal/enums/core/selection";
import { Case as CaseSchema } from "./universal/enums/feature/ud/case";
import { Gender as GenderSchema } from "./universal/enums/feature/ud/gender";
import { GrammaticalNumber as GrammaticalNumberSchema } from "./universal/enums/feature/ud/number";
import { MorphemeKindSchema } from "./universal/enums/kind/morpheme-kind";
import { PhrasemeKind as PhrasemeKindSchema } from "./universal/enums/kind/phraseme-kind";
import { Pos as PosSchema } from "./universal/enums/kind/pos";

export { type LingId, toLingId } from "./ling-id";
export {
	TARGET_LANGUAGES,
	TargetLanguageSchema,
} from "./universal/enums/core/language";

export const OrthographicStatus = OrthographicStatusSchema.enum;
export const SurfaceKind = SurfaceKindSchema.enum;
export const LemmaKind = LemmaKindSchema.enum;
export const Case = CaseSchema.enum;
export const Gender = GenderSchema.enum;
export const GrammaticalNumber = GrammaticalNumberSchema.enum;
export const MorphemeKind = MorphemeKindSchema.enum;
export const PhrasemeKind = PhrasemeKindSchema.enum;
export const Pos = PosSchema.enum;

export type OrthographicStatus = z.infer<typeof OrthographicStatusSchema>;
export type SurfaceKind = z.infer<typeof SurfaceKindSchema>;
export type LemmaKind = z.infer<typeof LemmaKindSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type GrammaticalNumber = z.infer<typeof GrammaticalNumberSchema>;
export type MorphemeKind = z.infer<typeof MorphemeKindSchema>;
export type PhrasemeKind = z.infer<typeof PhrasemeKindSchema>;
export type Pos = z.infer<typeof PosSchema>;
export type InherentFeatures = AbstractLemma<"Lexeme">["inherentFeatures"];
export type UnknownSelection = AbstractSelectionFor<"Unknown">;

export const SelectionSchema = {
	English: EnglishSelectionSchema,
	German: GermanSelectionSchema,
} satisfies SelectionSchemaShape;

export const LemmaSchema = {
	English: EnglishLemmaSchema,
	German: GermanLemmaSchema,
} satisfies LemmaSchemaShape;

export type Lemma<
	L extends TargetLanguage,
	LK extends LemmaKindFor<L>,
	D extends LemmaDiscriminatorFor<L, LK>,
> = InferSchema<(typeof LemmaSchema)[L][LK][D]>;

export type Selection<
	L extends TargetLanguage,
	OS extends SelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindArg<L, OS> = SelectionSurfaceKindArg<L, OS>,
	LK extends SelectionLemmaKindArg<L, OS, SK> = SelectionLemmaKindArg<
		L,
		OS,
		SK
	>,
	D extends SelectionDiscriminatorArg<
		L,
		OS,
		SK,
		LK
	> = SelectionDiscriminatorArg<L, OS, SK, LK>,
> = InferSchema<SelectionSchemaFor<L, OS, SK, LK, D>>;

export type AnyLemma<L extends TargetLanguage = TargetLanguage> = {
	[LL in L]: LanguageLemmaUnion<LL>;
}[L];

export type AnySelection<L extends TargetLanguage = TargetLanguage> = {
	[LL in L]: KnownSelectionUnionForLanguage<LL> | UnknownSelection;
}[L];

type SupportedLanguage = z.infer<typeof TargetLanguageSchema>;

type SelectionSchemaShape = {
	[L in SupportedLanguage]: SelectionSchemaLanguageShape;
};

type LanguageLemmaUnion<L extends TargetLanguage> = {
	[LK in keyof (typeof LemmaSchema)[L]]: {
		[D in keyof (typeof LemmaSchema)[L][LK]]: InferSchema<
			(typeof LemmaSchema)[L][LK][D]
		>;
	}[keyof (typeof LemmaSchema)[L][LK]];
}[keyof (typeof LemmaSchema)[L]];

type ValueOf<T> = T[keyof T];

type KnownSelectionUnionForLanguage<L extends TargetLanguage> = ValueOf<{
	[OS in Exclude<keyof (typeof SelectionSchema)[L], "Unknown">]: ValueOf<{
		[SK in keyof (typeof SelectionSchema)[L][OS]]: ValueOf<{
			[LK in keyof (typeof SelectionSchema)[L][OS][SK]]: InferSchema<
				ValueOf<(typeof SelectionSchema)[L][OS][SK][LK]>
			>;
		}>;
	}>;
}>;

type LemmaSchemaShape = {
	[L in SupportedLanguage]: LemmaSchemaLanguageShape;
};

type LemmaKindFor<L extends TargetLanguage> = keyof (typeof LemmaSchema)[L];

type LemmaDiscriminatorFor<
	L extends TargetLanguage,
	LK extends LemmaKindFor<L>,
> = keyof (typeof LemmaSchema)[L][LK];

type SelectionOrthographicStatusFor<L extends TargetLanguage> =
	keyof (typeof SelectionSchema)[L];

type KnownSelectionOrthographicStatusFor<L extends TargetLanguage> = Exclude<
	SelectionOrthographicStatusFor<L>,
	"Unknown"
>;

type SelectionSurfaceKindFor<
	L extends TargetLanguage,
	OS extends KnownSelectionOrthographicStatusFor<L>,
> = keyof (typeof SelectionSchema)[L][OS];

type SelectionLemmaKindFor<
	L extends TargetLanguage,
	OS extends KnownSelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindFor<L, OS>,
> = keyof (typeof SelectionSchema)[L][OS][SK];

type SelectionDiscriminatorFor<
	L extends TargetLanguage,
	OS extends KnownSelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindFor<L, OS>,
	LK extends SelectionLemmaKindFor<L, OS, SK>,
> = keyof (typeof SelectionSchema)[L][OS][SK][LK];

type SelectionSurfaceKindArg<
	L extends TargetLanguage,
	OS extends SelectionOrthographicStatusFor<L>,
> = OS extends KnownSelectionOrthographicStatusFor<L>
	? SelectionSurfaceKindFor<L, OS>
	: unknown;

type SelectionLemmaKindArg<
	L extends TargetLanguage,
	OS extends SelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindArg<L, OS>,
> = OS extends KnownSelectionOrthographicStatusFor<L>
	? SK extends SelectionSurfaceKindFor<L, OS>
		? SelectionLemmaKindFor<L, OS, SK>
		: never
	: unknown;

type SelectionDiscriminatorArg<
	L extends TargetLanguage,
	OS extends SelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindArg<L, OS>,
	LK extends SelectionLemmaKindArg<L, OS, SK>,
> = OS extends KnownSelectionOrthographicStatusFor<L>
	? SK extends SelectionSurfaceKindFor<L, OS>
		? LK extends SelectionLemmaKindFor<L, OS, SK>
			? SelectionDiscriminatorFor<L, OS, SK, LK>
			: never
		: never
	: unknown;

type SelectionSchemaFor<
	L extends TargetLanguage,
	OS extends SelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindArg<L, OS>,
	LK extends SelectionLemmaKindArg<L, OS, SK>,
	D extends SelectionDiscriminatorArg<L, OS, SK, LK>,
> = OS extends "Unknown"
	? (typeof SelectionSchema)[L]["Unknown"]
	: OS extends KnownSelectionOrthographicStatusFor<L>
		? SK extends SelectionSurfaceKindFor<L, OS>
			? LK extends SelectionLemmaKindFor<L, OS, SK>
				? D extends SelectionDiscriminatorFor<L, OS, SK, LK>
					? (typeof SelectionSchema)[L][OS][SK][LK][D]
					: never
				: never
			: never
		: never;

type InferSchema<T> = T extends ZodTypeAny ? z.infer<T> : never;
