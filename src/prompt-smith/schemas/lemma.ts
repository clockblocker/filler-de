import { z } from "zod/v3";
import {
	LinguisticUnitKindSchema,
	SurfaceKindSchema,
} from "../../linguistics/common/enums/core";
import { PARTS_OF_SPEECH_STR } from "../../linguistics/common/enums/linguistic-units/lexem/pos";

// Re-create POSSchema with zod/v3 to avoid v3/v4 runtime mismatch
// (pos.ts uses `import z from "zod"` which is v4)
const POSSchemaV3 = z.enum(PARTS_OF_SPEECH_STR);

const userInputSchema = z.object({
	context: z.string(),
	surface: z.string(),
});

const agentOutputSchema = z.object({
	lemma: z.string(),
	linguisticUnit: LinguisticUnitKindSchema,
	pos: POSSchemaV3.nullable().optional(),
	surfaceKind: SurfaceKindSchema,
});

export const lemmaSchemas = { agentOutputSchema, userInputSchema };
