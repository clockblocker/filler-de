import z from "zod/v3";
import type { TargetLanguage } from "../enums/core/language";
import type { OrthographicStatus, SurfaceKind } from "../enums/core/selection";
import { SenseEmojisSchema } from "../sense-emojis";

type EmptyZodRawShape = Record<never, never>;
type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;
type NonInflectionSurfaceKind = Exclude<SurfaceKind, "Inflection">;

type BuildLemmaSelectionArgs<
	LemmaIdentityShape extends z.ZodRawShape,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceKindLiteral extends NonInflectionSurfaceKind = "Lemma",
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	language: TargetLanguage;
	lemmaIdentityShape: LemmaIdentityShape;
	orthographicStatus?: OrthographicStatusLiteral;
	surfaceKind?: SurfaceKindLiteral;
	lemmaExtraShape?: LemmaExtraShape;
	surfaceExtraShape?: SurfaceExtraShape;
};

export function buildLemmaSelection<
	LemmaIdentityShape extends z.ZodRawShape,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceKindLiteral extends NonInflectionSurfaceKind = "Lemma",
	LemmaExtraShape extends z.ZodRawShape = EmptyZodRawShape,
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	language,
	lemmaIdentityShape,
	orthographicStatus = "Standard" as OrthographicStatusLiteral,
	surfaceKind = "Lemma" as SurfaceKindLiteral,
	lemmaExtraShape = {} as LemmaExtraShape,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildLemmaSelectionArgs<
	LemmaIdentityShape,
	OrthographicStatusLiteral,
	SurfaceKindLiteral,
	LemmaExtraShape,
	SurfaceExtraShape
>) {
	const lemmaSchema = z
		.object(lemmaIdentityShape)
		.extend({
			language: z.literal(language),
			senseEmojis: SenseEmojisSchema.optional(),
			spelledLemma: z.string(),
		})
		.extend(lemmaExtraShape);

	const surfaceSchema = z.object(surfaceExtraShape).extend({
		lemma: lemmaSchema,
		spelledSurface: z.string(),
		surfaceKind: z.literal(surfaceKind),
	});

	return z.object({
		language: z.literal(language),
		orthographicStatus: z.literal(orthographicStatus),
		surface: surfaceSchema,
	});
}
