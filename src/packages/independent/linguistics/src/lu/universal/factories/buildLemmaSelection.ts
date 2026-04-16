import z from "zod/v3";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "../enums/core/selection";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";
import type { KnownSelectionSchemaFor } from "./buildKnownSelection";
import { buildSelectionSchemaCore } from "./buildSelectionSchemaCore";
import type {
	SelectionLemmaIdentityShapeFor,
	SelectionSurfaceSchemaFor,
} from "./buildSelectionSurface";
import type { LemmaSchemaDescriptor } from "./lemma-schema-descriptor";

type EmptyZodRawShape = Record<never, never>;
type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;
type NonInflectionSurfaceKind = Exclude<SurfaceKind, "Inflection">;

type BuildLemmaSelectionArgs<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceKindLiteral extends NonInflectionSurfaceKind = "Lemma",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	lemma: LemmaDescriptor;
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
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceKindLiteral extends NonInflectionSurfaceKind = "Lemma",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	lemma,
	lemmaIdentityShape,
	orthographicStatus = "Standard" as OrthographicStatusLiteral,
	surfaceKind = "Lemma" as SurfaceKindLiteral,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildLemmaSelectionArgs<
	LemmaDescriptor,
	LK,
	D,
	OrthographicStatusLiteral,
	SurfaceKindLiteral,
	SurfaceExtraShape
>): KnownSelectionSchemaFor<
	LemmaDescriptor["language"],
	OrthographicStatusLiteral,
	SelectionSurfaceSchemaFor<
		LemmaDescriptor["language"],
		SelectionLemmaIdentityShapeFor<LK, D>,
		LemmaDescriptor["schema"],
		LemmaSurfaceShape<SurfaceKindLiteral, SurfaceExtraShape>
	>
> {
	return buildSelectionSchemaCore({
		lemma,
		lemmaIdentityShape,
		orthographicStatus,
		surfaceShape: {
			...surfaceExtraShape,
			surfaceKind: z.literal(surfaceKind),
		},
	});
}
