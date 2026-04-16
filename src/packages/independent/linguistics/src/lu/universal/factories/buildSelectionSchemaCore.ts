import type z from "zod/v3";
import type {
	LemmaKind,
	OrthographicStatus,
	SpellingRelation,
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
import type { LemmaSchemaDescriptor } from "./lemma-schema-descriptor";

type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

type SurfaceSchemaForDescriptorSelection<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	SurfaceShape extends z.ZodRawShape,
> = SelectionSurfaceSchemaFor<
	LemmaDescriptor["language"],
	SelectionLemmaIdentityShapeFor<LK, D>,
	LemmaDescriptor["schema"],
	SurfaceShape
>;

type BuildSelectionSchemaCoreArgs<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus,
	SurfaceShape extends z.ZodRawShape,
> = {
	lemma: LemmaDescriptor;
	lemmaIdentityShape: SelectionLemmaIdentityShapeFor<LK, D>;
	orthographicStatus?: OrthographicStatusLiteral;
	spellingRelation?: SpellingRelation;
	surfaceShape: SurfaceShape;
};

export function buildSelectionSchemaCore<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
	OrthographicStatusLiteral extends KnownOrthographicStatus = "Standard",
	SurfaceShape extends z.ZodRawShape = Record<never, never>,
>({
	lemma,
	lemmaIdentityShape,
	orthographicStatus = "Standard" as OrthographicStatusLiteral,
	spellingRelation,
	surfaceShape,
}: BuildSelectionSchemaCoreArgs<
	LemmaDescriptor,
	LK,
	D,
	OrthographicStatusLiteral,
	SurfaceShape
>): KnownSelectionSchemaFor<
	LemmaDescriptor["language"],
	OrthographicStatusLiteral,
	SurfaceSchemaForDescriptorSelection<LemmaDescriptor, LK, D, SurfaceShape>
> {
	type SurfaceSchema = SurfaceSchemaForDescriptorSelection<
		LemmaDescriptor,
		LK,
		D,
		SurfaceShape
	>;

	const surface = buildSelectionSurfaceSchema({
		lemma,
		lemmaIdentityShape,
		surfaceShape,
	});

	return buildKnownSelectionSchema({
		orthographicStatus,
		spellingRelation,
		surface,
	}) as KnownSelectionSchemaFor<
		LemmaDescriptor["language"],
		OrthographicStatusLiteral,
		SurfaceSchema
	>;
}
