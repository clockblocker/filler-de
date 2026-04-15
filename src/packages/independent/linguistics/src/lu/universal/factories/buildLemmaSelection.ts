import z from "zod/v3";
import type { AbstractSelectionFor } from "../abstract-selection";
import type { TargetLanguage } from "../enums/core/language";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "../enums/core/selection";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";
import {
	buildSelectionSurfaceSchema,
	type SelectionLemmaIdentityShapeFor,
} from "./buildSelectionSurface";

type EmptyZodRawShape = Record<never, never>;
type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;
type NonInflectionSurfaceKind = Exclude<SurfaceKind, "Inflection">;

type BuildLemmaSelectionArgs<
	LanguageLiteral extends TargetLanguage,
	LemmaSchema extends z.ZodTypeAny,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceKindLiteral extends NonInflectionSurfaceKind = "Lemma",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	language: LanguageLiteral;
	lemmaSchema: LemmaSchema;
	lemmaIdentityShape: SelectionLemmaIdentityShapeFor<LK, D>;
	orthographicStatus?: OrthographicStatusLiteral;
	surfaceKind?: SurfaceKindLiteral;
	surfaceExtraShape?: SurfaceExtraShape;
};

export function buildLemmaSelection<
	LanguageLiteral extends TargetLanguage,
	LemmaSchema extends z.ZodTypeAny,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceKindLiteral extends NonInflectionSurfaceKind = "Lemma",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	language,
	lemmaSchema,
	lemmaIdentityShape,
	orthographicStatus = "Standard" as OrthographicStatusLiteral,
	surfaceKind = "Lemma" as SurfaceKindLiteral,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildLemmaSelectionArgs<
	LanguageLiteral,
	LemmaSchema,
	LK,
	D,
	OrthographicStatusLiteral,
	SurfaceKindLiteral,
	SurfaceExtraShape
>) {
	const surfaceSchema = buildSelectionSurfaceSchema({
		language,
		lemmaIdentityShape,
		lemmaSchema,
		surfaceShape: {
			...surfaceExtraShape,
			surfaceKind: z.literal(surfaceKind),
		},
	});

	return z.object({
		language: z.literal(language),
		orthographicStatus: z.literal(orthographicStatus),
		spelledSelection: z.string(),
		surface: surfaceSchema,
	}) as unknown as z.ZodType<
		AbstractSelectionFor<
			OrthographicStatusLiteral,
			SurfaceKindLiteral,
			LK,
			D
		>
	>;
}
