import z from "zod/v3";
import type { Prettify } from "../../../../../../../types/helpers";
import type { LemmaKind } from "../enums/core/selection";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";
import type { LemmaSchemaDescriptor } from "./lemma-schema-descriptor";

const lemmaSubKindKeys = ["morphemeKind", "phrasemeKind", "pos"] as const;

type LemmaSubKindKey = (typeof lemmaSubKindKeys)[number];

type InferShape<Shape extends z.ZodRawShape> = {
	[K in keyof Shape]: z.infer<Shape[K]>;
};

export type SelectionLemmaIdentityShape = z.ZodRawShape & {
	lemmaKind: z.ZodTypeAny;
};

export type SelectionLemmaIdentityShapeFor<
	LK extends LemmaKind,
	D extends LemmaDiscriminatorFor<LK>,
> = LK extends "Lexeme"
	? {
			lemmaKind: z.ZodLiteral<LK>;
			pos: z.ZodLiteral<D>;
		}
	: LK extends "Morpheme"
		? {
				lemmaKind: z.ZodLiteral<LK>;
				morphemeKind: z.ZodLiteral<D>;
			}
		: LK extends "Phraseme"
			? {
					lemmaKind: z.ZodLiteral<LK>;
					phrasemeKind: z.ZodLiteral<D>;
				}
			: never;

type InferredLemmaIdentityFor<Shape extends SelectionLemmaIdentityShape> =
	InferShape<Shape>;

type LemmaSubKindKeyForValue<T extends { lemmaKind: unknown }> = Extract<
	keyof T,
	LemmaSubKindKey
>;

export type SelectionSurfaceValueFor<
	LanguageLiteral extends string,
	LemmaIdentity extends { lemmaKind: unknown },
	Lemma,
	Surface,
> = Prettify<
	Surface & {
		discriminators: {
			lemmaKind: LemmaIdentity["lemmaKind"];
			lemmaSubKind: LemmaIdentity[LemmaSubKindKeyForValue<LemmaIdentity>];
		};
		language: LanguageLiteral;
		normalizedFullSurface: string;
		target: { canonicalLemma: string } | Lemma;
	}
>;

export type SelectionSurfaceSchemaFor<
	LanguageLiteral extends string,
	LemmaIdentityShape extends SelectionLemmaIdentityShape,
	LemmaSchema extends z.ZodTypeAny,
	SurfaceShape extends z.ZodRawShape,
> = z.ZodType<
	SelectionSurfaceValueFor<
		LanguageLiteral,
		InferredLemmaIdentityFor<LemmaIdentityShape>,
		z.infer<LemmaSchema>,
		InferShape<SurfaceShape>
	>
>;

export type SelectionSurfaceSchemaDescriptorFor<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LemmaIdentityShape extends SelectionLemmaIdentityShape,
	SurfaceShape extends z.ZodRawShape,
> = {
	language: LemmaDescriptor["language"];
	schema: SelectionSurfaceSchemaFor<
		LemmaDescriptor["language"],
		LemmaIdentityShape,
		LemmaDescriptor["schema"],
		SurfaceShape
	>;
};

export function buildSelectionSurfaceSchema<
	LemmaDescriptor extends LemmaSchemaDescriptor<z.ZodTypeAny>,
	LemmaIdentityShape extends SelectionLemmaIdentityShape,
	SurfaceShape extends z.ZodRawShape,
>({
	lemma,
	lemmaIdentityShape,
	surfaceShape,
}: {
	lemma: LemmaDescriptor;
	lemmaIdentityShape: LemmaIdentityShape;
	surfaceShape: SurfaceShape;
}): SelectionSurfaceSchemaDescriptorFor<
	LemmaDescriptor,
	LemmaIdentityShape,
	SurfaceShape
> {
	const { language, schema: lemmaSchema } = lemma;
	const lemmaSubKindKey = getLemmaSubKindKey(lemmaIdentityShape);
	const lemmaSubKindSchema = lemmaIdentityShape[
		lemmaSubKindKey
	] as z.ZodTypeAny;

	const schema = z
		.object(surfaceShape)
		.extend({
			discriminators: z
				.object({
					lemmaKind: lemmaIdentityShape.lemmaKind,
					lemmaSubKind: lemmaSubKindSchema,
				})
				.strict(),
			language: z.literal(language),
			normalizedFullSurface: z.string(),
			target: z.union([
				z
					.object({
						canonicalLemma: getCanonicalLemmaSchema(lemmaSchema),
					})
					.strict(),
				lemmaSchema,
			]),
		})
		.strict()
		.superRefine((surface, ctx) => {
			const typedSurface = surface as {
				discriminators: {
					lemmaKind: unknown;
					lemmaSubKind: unknown;
				};
				language: string;
				target: { canonicalLemma: string } | Record<string, unknown>;
			};

			if (isUnresolvedSurfaceTarget(typedSurface.target)) {
				return;
			}

			const hydratedLemma = typedSurface.target;
			if (hydratedLemma.language !== typedSurface.language) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						"hydrated lemma language must match surface language",
					path: ["target", "language"],
				});
			}

			const lemmaSubKind = hydratedLemma[lemmaSubKindKey];

			if (
				hydratedLemma.lemmaKind !==
				typedSurface.discriminators.lemmaKind
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "hydrated lemmaKind must match discriminators",
					path: ["target", "lemma", "lemmaKind"],
				});
			}

			if (lemmaSubKind !== typedSurface.discriminators.lemmaSubKind) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "hydrated lemmaSubKind must match discriminators",
					path: ["target", "lemma", lemmaSubKindKey],
				});
			}
		}) as SelectionSurfaceSchemaFor<
		LemmaDescriptor["language"],
		LemmaIdentityShape,
		LemmaDescriptor["schema"],
		SurfaceShape
	>;

	return {
		language,
		schema,
	};
}

function getLemmaSubKindKey(
	lemmaIdentityShape: SelectionLemmaIdentityShape,
): LemmaSubKindKey {
	const matchingKeys = lemmaSubKindKeys.filter(
		(key) => key in lemmaIdentityShape,
	);
	if (matchingKeys.length !== 1) {
		throw new Error(
			"lemmaIdentityShape must include exactly one of pos, morphemeKind, or phrasemeKind",
		);
	}

	const [matchingKey] = matchingKeys;

	if (matchingKey === undefined) {
		throw new Error(
			"lemmaIdentityShape must resolve to a lemma subkind key",
		);
	}

	return matchingKey;
}

function isUnresolvedSurfaceTarget(
	target: { canonicalLemma: string } | Record<string, unknown>,
): target is { canonicalLemma: string } {
	return "canonicalLemma" in target && !("lemmaKind" in target);
}

function getCanonicalLemmaSchema(lemmaSchema: z.ZodTypeAny): z.ZodTypeAny {
	if (lemmaSchema instanceof z.ZodObject) {
		const shape = lemmaSchema.shape;
		const canonicalLemmaSchema = shape.canonicalLemma;
		if (canonicalLemmaSchema !== undefined) {
			return canonicalLemmaSchema;
		}
	}

	return z.string();
}
