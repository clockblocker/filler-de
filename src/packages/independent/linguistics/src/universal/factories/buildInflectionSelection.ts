import z from "zod/v3";
import type { OrthographicStatus } from "../enums/core/selection";

type EmptyZodRawShape = Record<never, never>;
type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

type BuildInflectionSelectionArgs<
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	LemmaIdentityShape extends z.ZodRawShape,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	inflectionalFeaturesSchema: InflectionalFeaturesSchema;
	lemmaIdentityShape: LemmaIdentityShape;
	orthographicStatus?: OrthographicStatusLiteral;
	lemmaExtraShape?: LemmaExtraShape;
	surfaceExtraShape?: SurfaceExtraShape;
};

export function buildInflectionSelection<
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	LemmaIdentityShape extends z.ZodRawShape,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	inflectionalFeaturesSchema,
	lemmaIdentityShape,
	orthographicStatus = "Standard" as OrthographicStatusLiteral,
	lemmaExtraShape = {} as LemmaExtraShape,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildInflectionSelectionArgs<
	InflectionalFeaturesSchema,
	LemmaIdentityShape,
	OrthographicStatusLiteral,
	LemmaExtraShape,
	SurfaceExtraShape
>) {
	const lemmaSchema = z
		.object(lemmaIdentityShape)
		.extend({
			spelledLemma: z.string(),
		})
		.extend(lemmaExtraShape);

	const surfaceSchema = z.object(surfaceExtraShape).extend({
		inflectionalFeatures: inflectionalFeaturesSchema,
		lemma: lemmaSchema,
		spelledSurface: z.string(),
		surfaceKind: z.literal("Inflection"),
	});

	return z.object({
		orthographicStatus: z.literal(orthographicStatus),
		surface: surfaceSchema,
	});
}
