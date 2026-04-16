import z from "zod/v3";
import type { TargetLanguage } from "../enums/core/language";
import type { LemmaKind, OrthographicStatus } from "../enums/core/selection";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";
import {
	buildKnownSelectionSchema,
	type KnownSelectionSchemaFor,
} from "./buildKnownSelection";
import {
	buildSelectionSurfaceSchema,
	type SelectionLemmaIdentityShapeFor,
	type SelectionSurfaceSchemaFor,
} from "./buildSelectionSurface";

type EmptyZodRawShape = Record<never, never>;
type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

type BuildInflectionSelectionArgs<
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	LanguageLiteral extends TargetLanguage,
	LemmaSchema extends z.ZodTypeAny,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	inflectionalFeaturesSchema: InflectionalFeaturesSchema;
	language: LanguageLiteral;
	lemmaSchema: LemmaSchema;
	lemmaIdentityShape: SelectionLemmaIdentityShapeFor<LK, D>;
	orthographicStatus?: OrthographicStatusLiteral;
	surfaceExtraShape?: SurfaceExtraShape;
};

type InflectionSurfaceShape<
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	SurfaceExtraShape extends z.ZodRawShape,
> = SurfaceExtraShape & {
	inflectionalFeatures: InflectionalFeaturesSchema;
	surfaceKind: z.ZodLiteral<"Inflection">;
};

export function buildInflectionSelection<
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	LanguageLiteral extends TargetLanguage,
	LemmaSchema extends z.ZodTypeAny,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	inflectionalFeaturesSchema,
	language,
	lemmaSchema,
	lemmaIdentityShape,
	orthographicStatus = "Standard" as OrthographicStatusLiteral,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildInflectionSelectionArgs<
	InflectionalFeaturesSchema,
	LanguageLiteral,
	LemmaSchema,
	LK,
	D,
	OrthographicStatusLiteral,
	SurfaceExtraShape
>): KnownSelectionSchemaFor<
	LanguageLiteral,
	OrthographicStatusLiteral,
	SelectionSurfaceSchemaFor<
		LanguageLiteral,
		SelectionLemmaIdentityShapeFor<LK, D>,
		LemmaSchema,
		InflectionSurfaceShape<InflectionalFeaturesSchema, SurfaceExtraShape>
	>
> {
	type SurfaceSchema = SelectionSurfaceSchemaFor<
		LanguageLiteral,
		SelectionLemmaIdentityShapeFor<LK, D>,
		LemmaSchema,
		InflectionSurfaceShape<InflectionalFeaturesSchema, SurfaceExtraShape>
	>;

	const surfaceSchema = buildSelectionSurfaceSchema({
		language,
		lemmaIdentityShape,
		lemmaSchema,
		surfaceShape: {
			...surfaceExtraShape,
			inflectionalFeatures: inflectionalFeaturesSchema,
			surfaceKind: z.literal("Inflection"),
		},
	});

	return buildKnownSelectionSchema({
		language,
		orthographicStatus,
		surfaceSchema,
	}) as KnownSelectionSchemaFor<
		LanguageLiteral,
		OrthographicStatusLiteral,
		SurfaceSchema
	>;
}
