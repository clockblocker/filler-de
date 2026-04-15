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

type FeatureSchemaFor<K extends keyof AbstractFeatures> = z.ZodType<
	AbstractFeatures[K],
	z.ZodTypeDef,
	AbstractFeatures[K]
>;

export type RestrictableFeatureSchemaShape = Partial<{
	[K in keyof AbstractFeatures]: FeatureSchemaFor<K>;
}>;

type ValidFeatureSchemaShape<Shape extends z.ZodRawShape> = {
	[K in keyof Shape]: K extends keyof AbstractFeatures
		? Shape[K] extends FeatureSchemaFor<K>
			? Shape[K]
			: never
		: never;
};

type OptionalizedFeatureSchemaShape<Shape extends z.ZodRawShape> = {
	[K in keyof Shape]: Shape[K] extends z.ZodTypeAny
		? z.ZodOptional<Shape[K]>
		: never;
};

export function featureValueSet<Schema extends z.ZodTypeAny>(schema: Schema) {
	return z.union([schema, z.array(schema).nonempty()]);
}

export function featureSpecificValueSets<
	Schema extends z.ZodTypeAny,
	const Allowed extends readonly (readonly [z.infer<Schema>, ...z.infer<
		Schema
	>[]])[],
>(schema: Schema, allowedValueSets: Allowed) {
	const exactSetSchema = z.array(schema).nonempty().superRefine((values, ctx) => {
		const normalizedValues = [...new Set(values)].sort();
		const isAllowed = allowedValueSets.some((allowedValues) => {
			const normalizedAllowedValues = [...allowedValues].sort();

			return (
				normalizedAllowedValues.length === normalizedValues.length &&
				normalizedAllowedValues.every(
					(allowedValue, index) => allowedValue === normalizedValues[index],
				)
			);
		});

		if (!isAllowed) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Unsupported feature value combination",
			});
		}
	});

	return z.union([schema, exactSetSchema]);
}

function makeFeatureSchemaShapeOptional<const Shape extends z.ZodRawShape>(
	shape: Shape,
): OptionalizedFeatureSchemaShape<Shape> {
	return Object.fromEntries(
		Object.entries(shape).map(([key, schema]) => [key, schema.optional()]),
	) as OptionalizedFeatureSchemaShape<Shape>;
}

export function featureSchema<const Shape extends z.ZodRawShape>(
	shape: Shape & ValidFeatureSchemaShape<Shape>,
): z.ZodObject<OptionalizedFeatureSchemaShape<Shape>, "strict"> {
	return z.object(makeFeatureSchemaShapeOptional(shape)).strict();
}
