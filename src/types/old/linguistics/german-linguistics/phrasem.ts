import { z } from "zod";
import {
	CollocationStrength,
	CollocationStrengthSchema,
	CollocationType,
	CollocationTypeSchema,
	DiscourseFormulaRoleSchema,
	PhrasemeType,
	POS,
	POSSchema,
} from "../../../../linguistics/old-enums";

const PhrasemeComponentSchema = z.object({
	baseForm: z.string(),
	isAnchor: z.boolean().optional(),
	pos: POSSchema,
	surface: z.string(),
});

const PhrasemeComponentsSchema = z
	.array(PhrasemeComponentSchema)
	.min(2)
	.refine((arr) => arr.filter((c) => c.isAnchor === true).length >= 1, {
		message: "At least one component must have isAnchor: true",
	});

export const PhrasemeBaseSchema = z.object({
	analogs: z.array(z.string()).optional(),
	explanation: z.string().optional(),
	phrasemeComponents: PhrasemeComponentsSchema,
	surface: z.string(),
	translation: z.string(),
});

export const CollocationSchema = z.object({
	collocationType: CollocationTypeSchema,
	phrasemeType: z.literal(PhrasemeType.Collocation),
	strength: CollocationStrengthSchema,
});

export const CulturalQuotationSchema = z.object({
	phrasemeType: z.literal(PhrasemeType.CulturalQuotation),
	source: z.string().optional(),
});

export const ProverbSchema = z.object({
	phrasemeType: z.literal(PhrasemeType.Proverb),
});

export const IdiomSchema = z.object({
	phrasemeType: z.literal(PhrasemeType.Idiom),
});

export const DiscourseFormulaSchema = z.object({
	phrasemeType: z.literal(PhrasemeType.DiscourseFormula),
	role: DiscourseFormulaRoleSchema,
});

export const PhrasemeSchema = z
	.discriminatedUnion("phrasemeType", [
		IdiomSchema,
		ProverbSchema,
		CulturalQuotationSchema,
		CollocationSchema,
		DiscourseFormulaSchema,
	])
	.and(PhrasemeBaseSchema);

export type Phraseme = z.infer<typeof PhrasemeSchema>;

export const collocationExamples: Record<Phraseme["surface"], Phraseme> = {
	"triftige Gründe": {
		collocationType: CollocationType.ADJ_plus_NOUN,
		phrasemeComponents: [
			{
				baseForm: "triftig",
				pos: POS.Adjective,
				surface: "triftige",
			},
			{
				baseForm: "Grund",
				isAnchor: true,
				pos: POS.Noun,
				surface: "Gründe",
			},
		],
		phrasemeType: PhrasemeType.Collocation,
		strength: CollocationStrength.Bound,
		surface: "triftige Gründe",
		translation: "compelling reasons",
	},
};

// export const PhrasemeSchema = z.discriminatedUnion('type', [
// 	IdiomSchema.extend(PhrasemeBaseSchema.shape),
// 	ProverbSchema.extend(PhrasemeBaseSchema.shape),
// 	CulturalQuotationSchema.extend(PhrasemeBaseSchema.shape),
// 	CollocationSchema.extend(PhrasemeBaseSchema.shape),
// 	DiscourseFormulaSchema.extend(PhrasemeBaseSchema.shape),
// ]);
