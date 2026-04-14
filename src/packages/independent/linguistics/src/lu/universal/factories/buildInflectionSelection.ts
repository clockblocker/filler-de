import z from "zod/v3";
import { SenseEmojisSchema } from "../sense-emojis";
import type { TargetLanguage } from "../enums/core/language";
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
	language: TargetLanguage;
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
	language,
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
			senseEmojis: SenseEmojisSchema.optional(),
			language: z.literal(language),
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
		language: z.literal(language),
		orthographicStatus: z.literal(orthographicStatus),
		surface: surfaceSchema,
	});
}
