import z, { type ZodTypeAny } from "zod/v3";
import { GermanLemmaSchema } from "./german/german-lemma";
import { GermanSelectionSchema } from "./german/german-selection";
import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "./registry-shapes";

const supportedLanguages = ["German"] as const;

const SupportedLanguage = z.enum(supportedLanguages);
type SupportedLanguage = z.infer<typeof SupportedLanguage>;

type SelectionSchemaShape = {
	[L in SupportedLanguage]: SelectionSchemaLanguageShape;
};

export const SelectionSchema = {
	German: GermanSelectionSchema,
} satisfies SelectionSchemaShape;

export const LemmaSchema = {
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

type LemmaSchemaShape = {
	[L in SupportedLanguage]: LemmaSchemaLanguageShape;
};

type TargetLanguage = keyof typeof LemmaSchema;

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
	: any;

type SelectionLemmaKindArg<
	L extends TargetLanguage,
	OS extends SelectionOrthographicStatusFor<L>,
	SK extends SelectionSurfaceKindArg<L, OS>,
> = OS extends KnownSelectionOrthographicStatusFor<L>
	? SK extends SelectionSurfaceKindFor<L, OS>
		? SelectionLemmaKindFor<L, OS, SK>
		: never
	: any;

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
	: any;

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
