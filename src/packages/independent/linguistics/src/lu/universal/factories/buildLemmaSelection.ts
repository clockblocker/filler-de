import z from "zod/v3";
import type { TargetLanguage } from "../enums/core/language";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "../enums/core/selection";
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

type LemmaSurfaceShape<
	SurfaceKindLiteral extends NonInflectionSurfaceKind,
	SurfaceExtraShape extends z.ZodRawShape,
> = SurfaceExtraShape & {
	surfaceKind: z.ZodLiteral<SurfaceKindLiteral>;
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
>): KnownSelectionSchemaFor<
	LanguageLiteral,
	OrthographicStatusLiteral,
	SelectionSurfaceSchemaFor<
		SelectionLemmaIdentityShapeFor<LK, D>,
		LemmaSchema,
		LemmaSurfaceShape<SurfaceKindLiteral, SurfaceExtraShape>
	>
> {
	type SurfaceSchema = SelectionSurfaceSchemaFor<
		SelectionLemmaIdentityShapeFor<LK, D>,
		LemmaSchema,
		LemmaSurfaceShape<SurfaceKindLiteral, SurfaceExtraShape>
	>;

	const surfaceSchema = buildSelectionSurfaceSchema({
		language,
		lemmaIdentityShape,
		lemmaSchema,
		surfaceShape: {
			...surfaceExtraShape,
			surfaceKind: z.literal(surfaceKind),
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
