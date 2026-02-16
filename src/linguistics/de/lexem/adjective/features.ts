import { z } from "zod/v3";
import type { POS } from "../../../common/enums/linguistic-units/lexem/pos";

const germanAdjectiveClassificationValues = [
	"Qualitative",
	"Relational",
	"Participial",
] as const;

export const GermanAdjectiveClassificationSchema = z.enum(
	germanAdjectiveClassificationValues,
);
export type GermanAdjectiveClassification = z.infer<
	typeof GermanAdjectiveClassificationSchema
>;

const germanAdjectiveGradabilityValues = ["Gradable", "NonGradable"] as const;

export const GermanAdjectiveGradabilitySchema = z.enum(
	germanAdjectiveGradabilityValues,
);
export type GermanAdjectiveGradability = z.infer<
	typeof GermanAdjectiveGradabilitySchema
>;

const germanAdjectiveDistributionValues = [
	"AttributiveAndPredicative",
	"AttributiveOnly",
	"PredicativeOnly",
] as const;

export const GermanAdjectiveDistributionSchema = z.enum(
	germanAdjectiveDistributionValues,
);
export type GermanAdjectiveDistribution = z.infer<
	typeof GermanAdjectiveDistributionSchema
>;

const germanAdjectiveGovernedPatternValues = [
	"None",
	"Dative",
	"Accusative",
	"Genitive",
	"Prepositional",
	"ZuInfinitive",
	"DassClause",
] as const;

export const GermanAdjectiveGovernedPatternSchema = z.enum(
	germanAdjectiveGovernedPatternValues,
);
export type GermanAdjectiveGovernedPattern = z.infer<
	typeof GermanAdjectiveGovernedPatternSchema
>;

export const GermanAdjectiveValencySchema = z
	.object({
		governedPattern: GermanAdjectiveGovernedPatternSchema,
		governedPreposition: z.string().min(1).max(30).optional(),
	})
	.superRefine((value, ctx) => {
		if (
			value.governedPattern === "Prepositional" &&
			!value.governedPreposition
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"governedPreposition is required when governedPattern is Prepositional",
				path: ["governedPreposition"],
			});
			return;
		}

		if (
			value.governedPattern !== "Prepositional" &&
			value.governedPreposition
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"governedPreposition is allowed only when governedPattern is Prepositional",
				path: ["governedPreposition"],
			});
		}
	});
export type GermanAdjectiveValency = z.infer<
	typeof GermanAdjectiveValencySchema
>;

/** Full features for an Adjective Lemma surface. */
export const GermanAdjectiveFullFeaturesSchema = z.object({
	classification: GermanAdjectiveClassificationSchema,
	distribution: GermanAdjectiveDistributionSchema,
	gradability: GermanAdjectiveGradabilitySchema,
	pos: z.literal("Adjective" satisfies POS),
	valency: GermanAdjectiveValencySchema,
});
export type GermanAdjectiveFullFeatures = z.infer<
	typeof GermanAdjectiveFullFeaturesSchema
>;

/** Ref features for Adjective Inflected/Variant — full profile lives on the Lemma entry. */
export const GermanAdjectiveRefFeaturesSchema = z.object({
	pos: z.literal("Adjective" satisfies POS),
});
export type GermanAdjectiveRefFeatures = z.infer<
	typeof GermanAdjectiveRefFeaturesSchema
>;
