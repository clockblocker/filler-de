import z from "zod/v3";

type EmptyZodRawShape = Record<never, never>;

type BuildInflectionSelectionArgs<
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	LemmaIdentityShape extends z.ZodRawShape,
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	inflectionalFeaturesSchema: InflectionalFeaturesSchema;
	lemmaIdentityShape: LemmaIdentityShape;
	lemmaExtraShape?: LemmaExtraShape;
	surfaceExtraShape?: SurfaceExtraShape;
};

export function buildInflectionSelection<
	InflectionalFeaturesSchema extends z.ZodTypeAny,
	LemmaIdentityShape extends z.ZodRawShape,
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	inflectionalFeaturesSchema,
	lemmaIdentityShape,
	lemmaExtraShape = {} as LemmaExtraShape,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildInflectionSelectionArgs<
	InflectionalFeaturesSchema,
	LemmaIdentityShape,
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
		orthographicStatus: z.literal("Standard"),
		surface: surfaceSchema,
	});
}
