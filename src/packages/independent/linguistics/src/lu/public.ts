import type z from "zod/v3";
import type { ZodTypeAny } from "zod/v3";
import { EnglishLemmaSchema } from "./english/english-lemma";
import { EnglishSelectionSchema } from "./english/english-selection";
import { GermanLemmaSchema } from "./german/german-lemma";
import { GermanSelectionSchema } from "./german/german-selection";
import { HebrewLemmaSchema } from "./hebrew/hebrew-lemma";
import { HebrewSelectionSchema } from "./hebrew/hebrew-selection";
import { buildResolvedSurfaceSchemaForLanguage } from "./resolved-surface-schema";
import type { TargetLanguage } from "./universal/enums/core/language";
import type { OrthographicStatus } from "./universal/enums/core/selection";
import { withLingIdSurfaceDtoCompatibility } from "./universal/ling-id-schema-compat";

type SupportedLanguage = TargetLanguage;
type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

export const SelectionSchema = {
	English: EnglishSelectionSchema,
	German: GermanSelectionSchema,
	Hebrew: HebrewSelectionSchema,
};

export const SurfaceSchema = {
	English: buildSurfaceSchemaForLanguage("English", EnglishSelectionSchema),
	German: buildSurfaceSchemaForLanguage("German", GermanSelectionSchema),
	Hebrew: buildSurfaceSchemaForLanguage("Hebrew", HebrewSelectionSchema),
};

export const ResolvedSurfaceSchema = {
	English: buildResolvedSurfaceSchemaForLanguage(SurfaceSchema.English),
	German: buildResolvedSurfaceSchemaForLanguage(SurfaceSchema.German),
	Hebrew: buildResolvedSurfaceSchemaForLanguage(SurfaceSchema.Hebrew),
};

export const LemmaSchema = {
	English: EnglishLemmaSchema,
	German: GermanLemmaSchema,
	Hebrew: HebrewLemmaSchema,
};

type ValueOf<T> = T[keyof T];

type InferSchema<T> = T extends ZodTypeAny ? z.infer<T> : never;

type ResolvedTargetFor<T> = Extract<T, { lemmaKind: unknown }>;

type UnresolvedTargetFor<T> = Exclude<T, { lemmaKind: unknown }>;

type ResolvedSurfaceValueFor<T> = T extends { target: infer Target }
	? [ResolvedTargetFor<Target>] extends [never]
		? never
		: Omit<T, "target"> & {
				target: ResolvedTargetFor<Target>;
			}
	: never;

type UnresolvedSurfaceValueFor<T> = T extends { target: infer Target }
	? [UnresolvedTargetFor<Target>] extends [never]
		? never
		: Omit<T, "target"> & {
				target: UnresolvedTargetFor<Target>;
			}
	: never;

type SelectionSchemaWithSurface = ZodTypeAny & {
	shape: {
		surface: ZodTypeAny;
	};
};

type KnownSelectionSchemaByLemmaKind = Record<
	string,
	Record<string, SelectionSchemaWithSurface>
>;

type KnownSelectionSchemaBySurfaceKind = Record<
	string,
	KnownSelectionSchemaByLemmaKind
>;

type KnownSelectionSchemaLanguageLike = {
	Standard: KnownSelectionSchemaBySurfaceKind;
	Typo: KnownSelectionSchemaBySurfaceKind;
	Unknown: ZodTypeAny;
};

type SurfaceSchemaFromSelectionSchema<T extends SelectionSchemaWithSurface> =
	T["shape"]["surface"];

type SurfaceSchemaByLemmaKindFromSelection<
	T extends KnownSelectionSchemaByLemmaKind,
> = {
	[LK in keyof T]: {
		[D in keyof T[LK]]: SurfaceSchemaFromSelectionSchema<T[LK][D]>;
	};
};

type SurfaceSchemaBySurfaceKindFromSelection<
	T extends KnownSelectionSchemaBySurfaceKind,
> = {
	[SK in keyof T]: SurfaceSchemaByLemmaKindFromSelection<T[SK]>;
};

type SurfaceSchemaLanguageFromSelection<
	T extends KnownSelectionSchemaLanguageLike,
> = {
	Standard: SurfaceSchemaBySurfaceKindFromSelection<T["Standard"]>;
	Typo: SurfaceSchemaBySurfaceKindFromSelection<T["Typo"]>;
};

type LanguageLemmaUnion<L extends TargetLanguage> = {
	[LK in keyof (typeof LemmaSchema)[L]]: {
		[D in keyof (typeof LemmaSchema)[L][LK]]: InferSchema<
			(typeof LemmaSchema)[L][LK][D]
		>;
	}[keyof (typeof LemmaSchema)[L][LK]];
}[keyof (typeof LemmaSchema)[L]];

type UnknownSelectionForLanguage<L extends TargetLanguage> = InferSchema<
	(typeof SelectionSchema)[L]["Unknown"]
>;

type KnownSelectionUnionForLanguage<L extends TargetLanguage> = ValueOf<{
	[OS in Exclude<keyof (typeof SelectionSchema)[L], "Unknown">]: ValueOf<{
		[SK in keyof (typeof SelectionSchema)[L][OS]]: ValueOf<{
			[LK in keyof (typeof SelectionSchema)[L][OS][SK]]: InferSchema<
				ValueOf<(typeof SelectionSchema)[L][OS][SK][LK]>
			>;
		}>;
	}>;
}>;

type SelectionUnionForLanguage<L extends TargetLanguage> =
	| KnownSelectionUnionForLanguage<L>
	| UnknownSelectionForLanguage<L>;

type KnownSurfaceUnionForLanguage<L extends TargetLanguage> =
	KnownSelectionUnionForLanguage<L>["surface"];

type LemmaKindFor<L extends TargetLanguage> = keyof (typeof LemmaSchema)[L];

type LemmaKindArg<L extends TargetLanguage> = LemmaKindFor<L>;

type LemmaDiscriminatorFor<
	L extends TargetLanguage,
	LK extends LemmaKindFor<L>,
> = keyof (typeof LemmaSchema)[L][LK];

type LemmaDiscriminatorArg<
	L extends TargetLanguage,
	LK extends LemmaKindArg<L>,
> = LK extends LemmaKindFor<L> ? LemmaDiscriminatorFor<L, LK> : never;

type LemmaSchemaFor<
	L extends TargetLanguage,
	LK extends LemmaKindArg<L>,
	D extends LemmaDiscriminatorArg<L, LK>,
> = LK extends LemmaKindFor<L>
	? D extends LemmaDiscriminatorFor<L, LK>
		? (typeof LemmaSchema)[L][LK][D]
		: never
	: never;

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

type SurfaceOrthographicStatusFor<L extends TargetLanguage> =
	keyof (typeof SurfaceSchema)[L];

type SurfaceSurfaceKindFor<
	L extends TargetLanguage,
	OS extends SurfaceOrthographicStatusFor<L>,
> = keyof (typeof SurfaceSchema)[L][OS];

type SurfaceLemmaKindFor<
	L extends TargetLanguage,
	OS extends SurfaceOrthographicStatusFor<L>,
	SK extends SurfaceSurfaceKindFor<L, OS>,
> = keyof (typeof SurfaceSchema)[L][OS][SK];

type SurfaceDiscriminatorFor<
	L extends TargetLanguage,
	OS extends SurfaceOrthographicStatusFor<L>,
	SK extends SurfaceSurfaceKindFor<L, OS>,
	LK extends SurfaceLemmaKindFor<L, OS, SK>,
> = keyof (typeof SurfaceSchema)[L][OS][SK][LK];

type SurfaceSchemaFor<
	L extends TargetLanguage,
	OS extends SurfaceOrthographicStatusFor<L>,
	SK extends SurfaceSurfaceKindFor<L, OS>,
	LK extends SurfaceLemmaKindFor<L, OS, SK>,
	D extends SurfaceDiscriminatorFor<L, OS, SK, LK>,
> = (typeof SurfaceSchema)[L][OS][SK][LK][D];

type SurfaceValue<
	L extends TargetLanguage = TargetLanguage,
	OS extends
		SurfaceOrthographicStatusFor<L> = SurfaceOrthographicStatusFor<L>,
	SK extends SurfaceSurfaceKindFor<L, OS> = SurfaceSurfaceKindFor<L, OS>,
	LK extends SurfaceLemmaKindFor<L, OS, SK> = SurfaceLemmaKindFor<L, OS, SK>,
	D extends SurfaceDiscriminatorFor<L, OS, SK, LK> = SurfaceDiscriminatorFor<
		L,
		OS,
		SK,
		LK
	>,
> = SurfaceOrthographicStatusFor<L> extends OS
	? KnownSurfaceUnionForLanguage<L>
	: InferSchema<SurfaceSchemaFor<L, OS, SK, LK, D>>;

export type Lemma<
	L extends TargetLanguage = TargetLanguage,
	LK extends LemmaKindArg<L> = LemmaKindArg<L>,
	D extends LemmaDiscriminatorArg<L, LK> = LemmaDiscriminatorArg<L, LK>,
> = LemmaKindFor<L> extends LK
	? LanguageLemmaUnion<L>
	: InferSchema<LemmaSchemaFor<L, LK, D>>;

export type Selection<
	L extends TargetLanguage = TargetLanguage,
	OS extends
		SelectionOrthographicStatusFor<L> = SelectionOrthographicStatusFor<L>,
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
> = SelectionOrthographicStatusFor<L> extends OS
	? SelectionUnionForLanguage<L>
	: InferSchema<SelectionSchemaFor<L, OS, SK, LK, D>>;

export type Surface<
	L extends TargetLanguage = TargetLanguage,
	OS extends
		SurfaceOrthographicStatusFor<L> = SurfaceOrthographicStatusFor<L>,
	SK extends SurfaceSurfaceKindFor<L, OS> = SurfaceSurfaceKindFor<L, OS>,
	LK extends SurfaceLemmaKindFor<L, OS, SK> = SurfaceLemmaKindFor<L, OS, SK>,
	D extends SurfaceDiscriminatorFor<L, OS, SK, LK> = SurfaceDiscriminatorFor<
		L,
		OS,
		SK,
		LK
	>,
> = SurfaceValue<L, OS, SK, LK, D>;

export type UnresolvedSurface<
	L extends TargetLanguage = TargetLanguage,
	OS extends
		SurfaceOrthographicStatusFor<L> = SurfaceOrthographicStatusFor<L>,
	SK extends SurfaceSurfaceKindFor<L, OS> = SurfaceSurfaceKindFor<L, OS>,
	LK extends SurfaceLemmaKindFor<L, OS, SK> = SurfaceLemmaKindFor<L, OS, SK>,
	D extends SurfaceDiscriminatorFor<L, OS, SK, LK> = SurfaceDiscriminatorFor<
		L,
		OS,
		SK,
		LK
	>,
> = UnresolvedSurfaceValueFor<SurfaceValue<L, OS, SK, LK, D>>;

export type ResolvedSurface<
	L extends TargetLanguage = TargetLanguage,
	OS extends
		SurfaceOrthographicStatusFor<L> = SurfaceOrthographicStatusFor<L>,
	SK extends SurfaceSurfaceKindFor<L, OS> = SurfaceSurfaceKindFor<L, OS>,
	LK extends SurfaceLemmaKindFor<L, OS, SK> = SurfaceLemmaKindFor<L, OS, SK>,
	D extends SurfaceDiscriminatorFor<L, OS, SK, LK> = SurfaceDiscriminatorFor<
		L,
		OS,
		SK,
		LK
	>,
> = ResolvedSurfaceValueFor<SurfaceValue<L, OS, SK, LK, D>>;

function buildSurfaceSchemaForLanguage<
	const T extends KnownSelectionSchemaLanguageLike,
>(
	language: SupportedLanguage,
	selectionSchema: T,
): SurfaceSchemaLanguageFromSelection<T> {
	return {
		Standard: buildSurfaceSchemaForOrthographicStatus(
			language,
			"Standard",
			selectionSchema.Standard,
		),
		Typo: buildSurfaceSchemaForOrthographicStatus(
			language,
			"Typo",
			selectionSchema.Typo,
		),
	} as SurfaceSchemaLanguageFromSelection<T>;
}

function buildSurfaceSchemaForOrthographicStatus<
	const T extends KnownSelectionSchemaBySurfaceKind,
>(
	language: SupportedLanguage,
	orthographicStatus: KnownOrthographicStatus,
	orthographicStatusSchema: T,
): SurfaceSchemaBySurfaceKindFromSelection<T> {
	return Object.fromEntries(
		Object.entries(orthographicStatusSchema).map(
			([surfaceKind, lemmaKinds]) => [
				surfaceKind,
				buildSurfaceSchemaForSurfaceKind(
					language,
					orthographicStatus,
					lemmaKinds,
				),
			],
		),
	) as SurfaceSchemaBySurfaceKindFromSelection<T>;
}

function buildSurfaceSchemaForSurfaceKind<
	const T extends KnownSelectionSchemaByLemmaKind,
>(
	language: SupportedLanguage,
	orthographicStatus: KnownOrthographicStatus,
	surfaceKindSchema: T,
): SurfaceSchemaByLemmaKindFromSelection<T> {
	return Object.fromEntries(
		Object.entries(surfaceKindSchema).map(([lemmaKind, discriminators]) => [
			lemmaKind,
			Object.fromEntries(
				Object.entries(discriminators).map(
					([discriminator, selectionSchema]) => [
						discriminator,
						withLingIdSurfaceDtoCompatibility({
							language,
							orthographicStatus,
							schema: getSurfaceSchemaFromSelectionSchema(
								selectionSchema,
							),
						}),
					],
				),
			),
		]),
	) as SurfaceSchemaByLemmaKindFromSelection<T>;
}

function getSurfaceSchemaFromSelectionSchema<T extends SelectionSchemaWithSurface>(
	selectionSchema: T,
): SurfaceSchemaFromSelectionSchema<T> {
	return selectionSchema.shape.surface;
}
