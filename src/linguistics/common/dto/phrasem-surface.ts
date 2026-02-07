import { z } from "zod/v3";
import { makeSurfaceSchema } from "./surface-factory";

const collocationStrengthValues = ["Weak", "Medium", "Strong"] as const;
export const CollocationStrengthSchema = z.enum(collocationStrengthValues);

/**
 * Phraseme kind literals re-declared in v3 to avoid importing v4 phrasem-kind.ts.
 * Must stay in sync with `phrasemeKinds` from `linguistics/common/enums/linguistic-units/phrasem/phrasem-kind.ts`.
 */
const phrasemStubs = [
	"Idiom",
	"DiscourseFormula",
	"Proverb",
	"CulturalQuotation",
] as const;

const fullCollocation = z.object({
	phrasemeKind: z.literal("Collocation"),
	strength: CollocationStrengthSchema.optional(),
});

const fullStubs = phrasemStubs.map((kind) =>
	z.object({ phrasemeKind: z.literal(kind) }),
);

const PhrasemFullFeaturesSchema = z.discriminatedUnion("phrasemeKind", [
	fullCollocation,
	...fullStubs,
]);

// Ref features: all phraseme kinds are just discriminant (no extra fields)
const refCollocation = z.object({
	phrasemeKind: z.literal("Collocation"),
});

const refStubs = phrasemStubs.map((kind) =>
	z.object({ phrasemeKind: z.literal(kind) }),
);

const PhrasemRefFeaturesSchema = z.discriminatedUnion("phrasemeKind", [
	refCollocation,
	...refStubs,
]);

export const PhrasemSurfaceSchema = makeSurfaceSchema(
	PhrasemFullFeaturesSchema,
	PhrasemRefFeaturesSchema,
);
export type PhrasemSurface = z.infer<typeof PhrasemSurfaceSchema>;
