import z from "zod/v3";
import type { LemmaKind } from "../enums/core/selection";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";

const lemmaSubKindKeys = ["morphemeKind", "phrasemeKind", "pos"] as const;

type LemmaSubKindKey = (typeof lemmaSubKindKeys)[number];

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

type BuildSelectionSurfaceArgs = {
	language: string;
	lemmaIdentityShape: SelectionLemmaIdentityShape;
	lemmaSchema: z.ZodTypeAny;
	surfaceShape: z.ZodRawShape;
};

export function buildSelectionSurfaceSchema({
	language,
	lemmaIdentityShape,
	lemmaSchema,
	surfaceShape,
}: BuildSelectionSurfaceArgs) {
	const lemmaSubKindKey = getLemmaSubKindKey(lemmaIdentityShape);

	return z
		.object(surfaceShape)
		.extend({
			discriminators: z
				.object({
					lemmaKind: lemmaIdentityShape.lemmaKind,
					lemmaSubKind: lemmaIdentityShape[lemmaSubKindKey],
				})
				.strict(),
			spelledSurface: z.string(),
			target: z.union([
				z.object({ spelledLemma: z.string() }).strict(),
				z.object({ lemma: lemmaSchema }).strict(),
			]),
		})
		.strict()
		.superRefine((surface, ctx) => {
			if (!("lemma" in surface.target)) {
				return;
			}

			const hydratedLemma = surface.target.lemma as Record<string, unknown>;
			if (hydratedLemma.language !== language) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "hydrated lemma language must match selection language",
					path: ["target", "lemma", "language"],
				});
			}

			const lemmaSubKind = hydratedLemma[lemmaSubKindKey];

			if (hydratedLemma.lemmaKind !== surface.discriminators.lemmaKind) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "hydrated lemmaKind must match discriminators",
					path: ["target", "lemma", "lemmaKind"],
				});
			}

			if (lemmaSubKind !== surface.discriminators.lemmaSubKind) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "hydrated lemmaSubKind must match discriminators",
					path: ["target", "lemma", lemmaSubKindKey],
				});
			}
		});
}

function getLemmaSubKindKey(
	lemmaIdentityShape: SelectionLemmaIdentityShape,
): LemmaSubKindKey {
	const matchingKeys = lemmaSubKindKeys.filter((key) => key in lemmaIdentityShape);
	if (matchingKeys.length !== 1) {
		throw new Error(
			"lemmaIdentityShape must include exactly one of pos, morphemeKind, or phrasemeKind",
		);
	}

	return matchingKeys[0];
}
