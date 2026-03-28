import { z } from "zod/v3";

/**
 * Factory that produces a surface schema (discriminated on "surfaceKind")
 * from Full-feature and Ref-feature schemas.
 *
 * Four variants:
 * - Lemma: canonical form with full features
 * - Inflected: derived form referencing a lemma entry
 * - Variant: spelling/orthographic variant referencing a lemma entry
 * - Partial: surface that covers only part of a multi-word lemma
 */
export function makeSurfaceSchema<
	F extends z.ZodTypeAny,
	R extends z.ZodTypeAny,
>(fullFeatures: F, refFeatures: R) {
	const lemma = z.object({
		features: fullFeatures,
		lemma: z.string().min(1),
		surfaceKind: z.literal("Lemma"),
	});

	const inflected = z.object({
		features: refFeatures,
		lemma: z.string().min(1),
		lemmaRef: z.string().min(1),
		surface: z.string().min(1),
		surfaceKind: z.literal("Inflected"),
	});

	const variant = z.object({
		features: refFeatures,
		lemma: z.string().min(1),
		lemmaRef: z.string().min(1),
		surface: z.string().min(1),
		surfaceKind: z.literal("Variant"),
	});

	const partial = z.object({
		features: refFeatures,
		lemma: z.string().min(1),
		lemmaRef: z.string().min(1),
		surface: z.string().min(1),
		surfaceKind: z.literal("Partial"),
	});

	return z.discriminatedUnion("surfaceKind", [
		lemma,
		inflected,
		variant,
		partial,
	]);
}
