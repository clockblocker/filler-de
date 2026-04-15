import z from "zod/v3";
import type { AbstractLemma } from "../abstract-lemma";
import type { AbstractSelectionFor } from "../abstract-selection";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "../enums/core/selection";
import type { AbstractFeatures } from "../enums/feature";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";

export type LemmaFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = AbstractLemma<LK, D>;

export type LemmaSchemaFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = z.ZodType<LemmaFor<LK, D>>;

export type SelectionFor<
	OS extends OrthographicStatus = OrthographicStatus,
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = AbstractSelectionFor<OS, SK, LK, D>;

export type SelectionSchemaFor<
	OS extends OrthographicStatus = OrthographicStatus,
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = z.ZodType<SelectionFor<OS, SK, LK, D>>;

type RestrictableFeatureSchemaFor<K extends keyof AbstractFeatures> = z.ZodType<
	AbstractFeatures[K] | undefined,
	z.ZodTypeDef,
	AbstractFeatures[K] | undefined
>;

export type RestrictableFeatureSchemaShape = Partial<{
	[K in keyof AbstractFeatures]: RestrictableFeatureSchemaFor<K>;
}>;

type ValidFeatureSchemaShape<Shape extends z.ZodRawShape> = {
	[K in keyof Shape]: K extends keyof AbstractFeatures
		? Shape[K] extends RestrictableFeatureSchemaFor<K>
			? Shape[K]
			: never
		: never;
};

export function featureSchema<const Shape extends z.ZodRawShape>(
	shape: Shape & ValidFeatureSchemaShape<Shape>,
): z.ZodObject<Shape, "strict"> {
	return z.object(shape).strict();
}
