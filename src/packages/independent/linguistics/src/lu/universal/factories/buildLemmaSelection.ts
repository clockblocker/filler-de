import z from "zod/v3";
import type { AbstractLemma } from "../abstract-lemma";
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
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceKindLiteral extends NonInflectionSurfaceKind = "Lemma",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	language: TargetLanguage;
	lemmaSchema: z.ZodType<AbstractLemma<LK, D>>;
	lemmaIdentityShape: SelectionLemmaIdentityShapeFor<LK, D>;
	orthographicStatus?: OrthographicStatusLiteral;
	surfaceKind?: SurfaceKindLiteral;
	surfaceExtraShape?: SurfaceExtraShape;
};

export function buildLemmaSelection<
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
	LK,
	D,
	OrthographicStatusLiteral,
	SurfaceKindLiteral,
	SurfaceExtraShape
>): z.ZodType<
	AbstractSelectionFor<OrthographicStatusLiteral, SurfaceKindLiteral, LK, D>
> {
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
