import z from 'zod/v4';
import {
	PartOfSpeech,
	PhrasemeType,
	CollocationTypeSchema,
	CollocationStrengthSchema,
	DiscourseFormulaRoleSchema,
	CollocationType,
	CollocationStrength,
} from 'types/beta/general/consts/linguistics-consts';

const PhrasemeComponentSchema = z.object({
	surface: z.string(),
	baseForm: z.string(),
	pos: PartOfSpeech,
	isAnchor: z.boolean().optional(),
});

const PhrasemeComponentsSchema = z
	.array(PhrasemeComponentSchema)
	.min(2)
	.refine((arr) => arr.filter((c) => c.isAnchor === true).length >= 1, {
		message: 'At least one component must have isAnchor: true',
	});

export const PhrasemeBaseSchema = z.object({
	surface: z.string(),
	phrasemeComponents: PhrasemeComponentsSchema,
	translation: z.string(),
	explanation: z.string().optional(),
	analogs: z.array(z.string()).optional(),
});

export const CollocationSchema = z.object({
	phrasemeType: z.literal(PhrasemeType.Collocation),
	collocationType: CollocationTypeSchema,
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
	.discriminatedUnion('type', [
		IdiomSchema,
		ProverbSchema,
		CulturalQuotationSchema,
		CollocationSchema,
		DiscourseFormulaSchema,
	])
	.and(PhrasemeBaseSchema);

export type Phraseme = z.infer<typeof PhrasemeSchema>;

export const collocationExamples: Record<Phraseme['surface'], Phraseme> = {
	'triftige Gründe': {
		surface: 'triftige Gründe',
		phrasemeType: PhrasemeType.Collocation,
		phrasemeComponents: [
			{
				surface: 'triftige',
				baseForm: 'triftig',
				pos: PartOfSpeech.Adjective,
			},
			{
				surface: 'Gründe',
				baseForm: 'Grund',
				pos: PartOfSpeech.Noun,
				isAnchor: true,
			},
		],
		collocationType: CollocationType.ADJ_plus_NOUN,
		strength: CollocationStrength.Bound,
		translation: 'compelling reasons',
	},
};

// export const PhrasemeSchema = z.discriminatedUnion('type', [
// 	IdiomSchema.extend(PhrasemeBaseSchema.shape),
// 	ProverbSchema.extend(PhrasemeBaseSchema.shape),
// 	CulturalQuotationSchema.extend(PhrasemeBaseSchema.shape),
// 	CollocationSchema.extend(PhrasemeBaseSchema.shape),
// 	DiscourseFormulaSchema.extend(PhrasemeBaseSchema.shape),
// ]);
