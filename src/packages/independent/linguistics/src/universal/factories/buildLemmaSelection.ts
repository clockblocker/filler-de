import z from "zod/v3";

type EmptyZodRawShape = Record<never, never>;

type BuildLemmaSelectionArgs<
	LemmaIdentityShape extends z.ZodRawShape,
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	lemmaIdentityShape: LemmaIdentityShape;
	lemmaExtraShape?: LemmaExtraShape;
	surfaceExtraShape?: SurfaceExtraShape;
};

export function buildLemmaSelection<
	LemmaIdentityShape extends z.ZodRawShape,
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	lemmaIdentityShape,
	lemmaExtraShape = {} as LemmaExtraShape,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildLemmaSelectionArgs<
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
		lemma: lemmaSchema,
		spelledSurface: z.string(),
		surfaceKind: z.literal("Lemma"),
	});

	return z.object({
		orthographicStatus: z.literal("Standard"),
		surface: surfaceSchema,
	});
}
