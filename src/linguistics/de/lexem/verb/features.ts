import { z } from "zod/v3";
import type { POS } from "../../../common/enums/linguistic-units/lexem/pos";

const germanVerbConjugationValues = ["Irregular", "Rregular"] as const;

export const GermanVerbConjugationSchema = z.enum(germanVerbConjugationValues);
export type GermanVerbConjugation = z.infer<typeof GermanVerbConjugationSchema>;

const germanVerbSeparabilityValues = [
	"Separable",
	"Inseparable",
	"None",
] as const;

export const GermanVerbSeparabilitySchema = z.enum(
	germanVerbSeparabilityValues,
);
export type GermanVerbSeparability = z.infer<
	typeof GermanVerbSeparabilitySchema
>;

const germanVerbReflexivityValues = [
	"NonReflexive",
	"ReflexiveOnly",
	"OptionalReflexive",
] as const;

export const GermanVerbReflexivitySchema = z.enum(germanVerbReflexivityValues);
export type GermanVerbReflexivity = z.infer<typeof GermanVerbReflexivitySchema>;

export const GermanVerbValencySchema = z.object({
	governedPreposition: z.string().min(1).max(30).nullable().optional(),
	reflexivity: GermanVerbReflexivitySchema,
	separability: GermanVerbSeparabilitySchema,
});
export type GermanVerbValency = z.infer<typeof GermanVerbValencySchema>;

/** Full features for a Verb Lemma surface. */
export const GermanVerbFullFeaturesSchema = z.object({
	conjugation: GermanVerbConjugationSchema,
	pos: z.literal("Verb" satisfies POS),
	valency: GermanVerbValencySchema,
});
export type GermanVerbFullFeatures = z.infer<
	typeof GermanVerbFullFeaturesSchema
>;

/** Ref features for Verb Inflected/Variant — full verb profile lives on the Lemma entry. */
export const GermanVerbRefFeaturesSchema = z.object({
	pos: z.literal("Verb" satisfies POS),
});
export type GermanVerbRefFeatures = z.infer<typeof GermanVerbRefFeaturesSchema>;

function normalizePreposition(preposition: string): string {
	return preposition.trim().toLowerCase();
}

export function buildGermanVerbEntryIdentity(
	profile: Pick<GermanVerbFullFeatures, "conjugation" | "valency">,
): string {
	const normalizedPreposition = profile.valency.governedPreposition
		? normalizePreposition(profile.valency.governedPreposition)
		: "none";

	return [
		`conjugation:${profile.conjugation}`,
		`separability:${profile.valency.separability}`,
		`reflexivity:${profile.valency.reflexivity}`,
		`preposition:${normalizedPreposition}`,
	].join("|");
}
