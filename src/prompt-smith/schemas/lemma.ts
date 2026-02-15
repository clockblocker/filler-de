import { z } from "zod/v3";
import {
	LinguisticUnitKindSchema,
	SurfaceKindSchema,
} from "../../linguistics/common/enums/core";
import { PARTS_OF_SPEECH_STR } from "../../linguistics/common/enums/linguistic-units/lexem/pos";
import { PhrasemeKindSchema } from "../../linguistics/common/enums/linguistic-units/phrasem/phrasem-kind";

// Re-create POSSchema with zod/v3 to avoid v3/v4 runtime mismatch
// (pos.ts uses `import z from "zod"` which is v4)
const POSSchemaV3 = z.enum(PARTS_OF_SPEECH_STR);

const userInputSchema = z.object({
	context: z.string(),
	surface: z.string(),
});

// Re-create NounClassSchema with zod/v3 to avoid v3/v4 runtime mismatch
const NounClassSchemaV3 = z.enum(["Common", "Proper"]);

// Re-create GermanGenusSchema with zod/v3 (features.ts uses v3 too, but keep local for consistency)
const GermanGenusSchemaV3 = z.enum(["Maskulinum", "Femininum", "Neutrum"]);

const baseAgentOutputSchema = z.object({
	contextWithLinkedParts: z.string().nullable().optional(),
	emojiDescription: z.array(z.string().min(1).max(4)).min(1).max(3),
	fullSurface: z.string().nullable().optional(),
	genus: GermanGenusSchemaV3.nullable().optional(),
	ipa: z.string().min(1),
	lemma: z.string(),
	linguisticUnit: LinguisticUnitKindSchema,
	nounClass: NounClassSchemaV3.nullable().optional(),
	pos: POSSchemaV3.nullable().optional(),
	surfaceKind: SurfaceKindSchema,
});

const lexemOutputSchema = baseAgentOutputSchema.extend({
	linguisticUnit: z.literal("Lexem"),
});

const phrasemOutputSchema = baseAgentOutputSchema.extend({
	linguisticUnit: z.literal("Phrasem"),
	phrasemeKind: PhrasemeKindSchema,
});

const morphemOutputSchema = baseAgentOutputSchema.extend({
	linguisticUnit: z.literal("Morphem"),
});

const agentOutputSchema = z.discriminatedUnion("linguisticUnit", [
	lexemOutputSchema,
	phrasemOutputSchema,
	morphemOutputSchema,
]);

export const lemmaSchemas = { agentOutputSchema, userInputSchema };
