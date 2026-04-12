import z, { type ZodTypeAny } from "zod/v3";
import { GermanLemmaSchema } from "./german/german-lemma";
import { GermanSelectionSchema } from "./german/german-selection";
import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "./registry-shapes";

const supportedTargetLanguages = ["German"] as const;

const TargetLang = z.enum(supportedTargetLanguages);
type TargetLang = z.infer<typeof TargetLang>;

type SelectionSchemaShape = {
	[L in TargetLang]: SelectionSchemaLanguageShape;
};

export const SelectionSchema = {
	German: GermanSelectionSchema,
} satisfies SelectionSchemaShape;

export const LemmaSchema = {
	German: GermanLemmaSchema,
} satisfies LemmaSchemaShape;

export type Lemma<
	L extends Language,
	LK extends LemmaKindFor<L>,
	D extends LemmaDiscriminatorFor<L, LK>,
> = InferSchema<(typeof LemmaSchema)[L][LK][D]>;

export type Selection<
	L extends Language,
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

type LemmaSchemaShape = {
	[L in TargetLang]: LemmaSchemaLanguageShape;
};

type Language = keyof typeof LemmaSchema;

type LemmaKindFor<L extends Language> = keyof (typeof LemmaSchema)[L];

type LemmaDiscriminatorFor<
	L extends Language,
	LK extends LemmaKindFor<L>,
> = keyof (typeof LemmaSchema)[L][LK];

type SelectionOrthographicStatusFor<L extends Language> =
	keyof (typeof SelectionSchema)[L];

type KnownSelectionOrthographicStatusFor<L extends Language> = Exclude<
	SelectionOrthographicStatusFor<L>,
	"Unknown"
>;

type SelectionSurfaceKindFor<
	L extends Language,
	OS extends KnownSelectionOrthographicStatusFor<L>,
> = keyof (typeof SelectionSchema)[L][OS];

type SelectionLemmaKindFor<
	L extends Language,
	OS extends KnownSelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindFor<L, OS>,
> = keyof (typeof SelectionSchema)[L][OS][SK];

type SelectionDiscriminatorFor<
	L extends Language,
	OS extends KnownSelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindFor<L, OS>,
	LK extends SelectionLemmaKindFor<L, OS, SK>,
> = keyof (typeof SelectionSchema)[L][OS][SK][LK];

type SelectionSurfaceKindArg<
	L extends Language,
	OS extends SelectionOrthographicStatusFor<L>,
> = OS extends KnownSelectionOrthographicStatusFor<L>
	? SelectionSurfaceKindFor<L, OS>
	: any;

type SelectionLemmaKindArg<
	L extends Language,
	OS extends SelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindArg<L, OS>,
> = OS extends KnownSelectionOrthographicStatusFor<L>
	? SK extends SelectionSurfaceKindFor<L, OS>
		? SelectionLemmaKindFor<L, OS, SK>
		: never
	: any;

type SelectionDiscriminatorArg<
	L extends Language,
	OS extends SelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindArg<L, OS>,
	LK extends SelectionLemmaKindArg<L, OS, SK>,
> = OS extends KnownSelectionOrthographicStatusFor<L>
	? SK extends SelectionSurfaceKindFor<L, OS>
		? LK extends SelectionLemmaKindFor<L, OS, SK>
			? SelectionDiscriminatorFor<L, OS, SK, LK>
			: never
		: never
	: any;

type SelectionSchemaFor<
	L extends Language,
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
