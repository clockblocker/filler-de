import { z } from "zod/v3";
import { CollocationStrengthSchema } from "../enums/linguistic-units/phrasem/collocation-strength";
import { CollocationTypeSchema } from "../enums/linguistic-units/phrasem/collocation-type";
import { DiscourseFormulaRoleSchema } from "../enums/linguistic-units/phrasem/discourse-formula-role";
import { makeSurfaceSchema } from "./surface-factory";

/**
 * Phraseme kind literals re-declared in v3 to avoid importing v4 phrasem-kind.ts.
 * Must stay in sync with `phrasemeKinds` from `linguistics/common/enums/linguistic-units/phrasem/phrasem-kind.ts`.
 */
const phrasemStubs = ["Idiom", "Proverb", "CulturalQuotation"] as const;

const fullCollocation = z.object({
	collocationType: CollocationTypeSchema.optional(),
	phrasemeKind: z.literal("Collocation"),
	strength: CollocationStrengthSchema.optional(),
});

const fullDiscourseFormula = z.object({
	phrasemeKind: z.literal("DiscourseFormula"),
	role: DiscourseFormulaRoleSchema.optional(),
});

const fullStubs = phrasemStubs.map((kind) =>
	z.object({ phrasemeKind: z.literal(kind) }),
);

const PhrasemFullFeaturesSchema = z.discriminatedUnion("phrasemeKind", [
	fullCollocation,
	fullDiscourseFormula,
	...fullStubs,
]);

// Ref features: all phraseme kinds are just discriminant (no extra fields)
const refCollocation = z.object({
	phrasemeKind: z.literal("Collocation"),
});

const refDiscourseFormula = z.object({
	phrasemeKind: z.literal("DiscourseFormula"),
});

const refStubs = phrasemStubs.map((kind) =>
	z.object({ phrasemeKind: z.literal(kind) }),
);

const PhrasemRefFeaturesSchema = z.discriminatedUnion("phrasemeKind", [
	refCollocation,
	refDiscourseFormula,
	...refStubs,
]);

export const PhrasemSurfaceSchema = makeSurfaceSchema(
	PhrasemFullFeaturesSchema,
	PhrasemRefFeaturesSchema,
);
export type PhrasemSurface = z.infer<typeof PhrasemSurfaceSchema>;
