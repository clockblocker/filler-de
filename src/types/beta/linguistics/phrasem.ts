import z from 'zod/v4';
import {
	PartOfSpeech,
	PhrasemeType,
	CollocationTypeSchema,
	CollocationStrengthSchema,
	DiscourseFormulaRoleSchema,
	CollocationType,
	CollocationStrength,
} from 'types/beta/consts/linguistics-consts';

export const PhrasemeBaseSchema = z.object({
	surface: z.string(),
	translation: z.string(),
	explanation: z.string(),
	analog: z.string().optional(),
});

const CollocationComponentSchema = z.object({
	surface: z.string(),
	baseForm: z.string(),
	pos: PartOfSpeech,
	isAnchor: z.boolean().optional(),
});

export const CollocationSchema = z.object({
	type: z.literal(PhrasemeType.Collocation),
	components: z
		.array(CollocationComponentSchema)
		.min(2)
		.refine((arr) => arr.filter((c) => c.isAnchor === true).length === 1, {
			message: 'One component must have isAnchor: true',
		}),
	collocationType: CollocationTypeSchema,
	strength: CollocationStrengthSchema,
});

export const CulturalQuotationSchema = z.object({
	type: z.literal(PhrasemeType.CulturalQuotation),
	source: z.string().optional(),
});

export const ProverbSchema = z.object({
	type: z.literal(PhrasemeType.Proverb),
});

export const IdiomSchema = z.object({
	type: z.literal(PhrasemeType.Idiom),
});

export const DiscourseFormulaSchema = z.object({
	type: z.literal(PhrasemeType.DiscourseFormula),
	role: DiscourseFormulaRoleSchema,
});

export type DiscourseFormula = z.infer<typeof DiscourseFormulaSchema>;

export type Idiom = z.infer<typeof IdiomSchema>;

export type Proverb = z.infer<typeof ProverbSchema>;

export type CulturalQuotation = z.infer<typeof CulturalQuotationSchema>;

export type Collocation = z.infer<typeof CollocationSchema>;

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

export const collocationExamples: Record<Phraseme['surface'], Collocation> = {
	'triftige Gründe': {
		type: PhrasemeType.Collocation,
		components: [
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
	},
};

// export const PhrasemeSchema = z.discriminatedUnion('type', [
// 	IdiomSchema.extend(PhrasemeBaseSchema.shape),
// 	ProverbSchema.extend(PhrasemeBaseSchema.shape),
// 	CulturalQuotationSchema.extend(PhrasemeBaseSchema.shape),
// 	CollocationSchema.extend(PhrasemeBaseSchema.shape),
// 	DiscourseFormulaSchema.extend(PhrasemeBaseSchema.shape),
// ]);
