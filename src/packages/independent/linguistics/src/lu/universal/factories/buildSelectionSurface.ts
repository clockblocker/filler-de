import z from "zod/v3";
import type { LemmaKind } from "../enums/core/selection";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";

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

type LemmaSubKindKeyFor<Shape extends SelectionLemmaIdentityShape> = Extract<
	keyof Shape,
	LemmaSubKindKey
>;

export type SelectionSurfaceValueFor<
	LemmaIdentityShape extends SelectionLemmaIdentityShape,
	LemmaSchema extends z.ZodTypeAny,
	SurfaceShape extends z.ZodRawShape,
> = InferShape<SurfaceShape> & {
	discriminators: {
		lemmaKind: z.infer<LemmaIdentityShape["lemmaKind"]>;
		lemmaSubKind: z.infer<
			LemmaIdentityShape[LemmaSubKindKeyFor<LemmaIdentityShape>]
		>;
	};
	normalizedFullSurface: string;
	target: { canonicalLemma: string } | z.infer<LemmaSchema>;
};

export type SelectionSurfaceSchemaFor<
	LemmaIdentityShape extends SelectionLemmaIdentityShape,
	LemmaSchema extends z.ZodTypeAny,
	SurfaceShape extends z.ZodRawShape,
> = z.ZodType<
	SelectionSurfaceValueFor<LemmaIdentityShape, LemmaSchema, SurfaceShape>
>;

export function buildSelectionSurfaceSchema<
	LemmaIdentityShape extends SelectionLemmaIdentityShape,
	LemmaSchema extends z.ZodTypeAny,
	SurfaceShape extends z.ZodRawShape,
>({
	language,
	lemmaIdentityShape,
	lemmaSchema,
	surfaceShape,
}: {
	language: string;
	lemmaIdentityShape: LemmaIdentityShape;
	lemmaSchema: LemmaSchema;
	surfaceShape: SurfaceShape;
}): SelectionSurfaceSchemaFor<LemmaIdentityShape, LemmaSchema, SurfaceShape> {
	const lemmaSubKindKey = getLemmaSubKindKey(lemmaIdentityShape);
	const lemmaSubKindSchema = lemmaIdentityShape[
		lemmaSubKindKey
	] as z.ZodTypeAny;

	return z
		.object(surfaceShape)
		.extend({
			discriminators: z
				.object({
					lemmaKind: lemmaIdentityShape.lemmaKind,
					lemmaSubKind: lemmaSubKindSchema,
				})
				.strict(),
			normalizedFullSurface: z.string(),
			target: z.union([
				z.object({ canonicalLemma: z.string() }).strict(),
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
				target: { canonicalLemma: string } | Record<string, unknown>;
			};

			if (isUnresolvedSurfaceTarget(typedSurface.target)) {
				return;
			}

			const hydratedLemma = typedSurface.target;
			if (hydratedLemma.language !== language) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						"hydrated lemma language must match selection language",
					path: ["target", "lemma", "language"],
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
		LemmaIdentityShape,
		LemmaSchema,
		SurfaceShape
	>;
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
