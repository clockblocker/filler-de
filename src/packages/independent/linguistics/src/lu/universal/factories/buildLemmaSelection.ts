import z from "zod/v3";
import type {
	LemmaKind,
	OrthographicStatus,
	SpellingRelation,
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

type BuildLemmaSelectionArgs<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
> = {
	lemma: LemmaDescriptor;
	lemmaIdentityShape: SelectionLemmaIdentityShapeFor<LK, D>;
	orthographicStatus?: OrthographicStatusLiteral;
	spellingRelation?: SpellingRelation;
	surfaceExtraShape?: SurfaceExtraShape;
};

type LemmaSurfaceShape<SurfaceExtraShape extends z.ZodRawShape> =
	SurfaceExtraShape & {
		surfaceKind: z.ZodLiteral<"Lemma">;
	};

export function buildLemmaSelection<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceExtraShape extends z.ZodRawShape = EmptyZodRawShape,
>({
	lemma,
	lemmaIdentityShape,
	orthographicStatus = "Standard" as OrthographicStatusLiteral,
	spellingRelation,
	surfaceExtraShape = {} as SurfaceExtraShape,
}: BuildLemmaSelectionArgs<
	LemmaDescriptor,
	LK,
	D,
	OrthographicStatusLiteral,
	SurfaceExtraShape
>): KnownSelectionSchemaFor<
	LemmaDescriptor["language"],
	OrthographicStatusLiteral,
	SelectionSurfaceSchemaFor<
		LemmaDescriptor["language"],
		SelectionLemmaIdentityShapeFor<LK, D>,
		LemmaDescriptor["schema"],
		LemmaSurfaceShape<SurfaceExtraShape>
	>
> {
	return buildSelectionSchemaCore({
		lemma,
		lemmaIdentityShape,
		orthographicStatus,
		spellingRelation,
		surfaceShape: {
			...surfaceExtraShape,
			surfaceKind: z.literal("Lemma"),
		},
	});
}
