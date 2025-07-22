import z from 'zod';
import { CollocationStrengthSchema } from './collocation-strength/collocationStrength';
import { CollocationTypeSchema } from './collocation-type/collocationType';
import { PhrasemeType } from '../phrasem-base/phrasem-type/phrasemType';
import { PartOfSpeech } from '../../lexem/pos/pos';
import { PhrasemeBaseSchema } from '../phrasem-base/phrasemBase';

const CollocationComponentSchema = z.object({
	lexem: z.string(),
	baseForm: z.string(),
	pos: PartOfSpeech,
	isAnchor: z.boolean().optional(),
});

export const CollocationSchema = z
	.object({
		type: z.literal(PhrasemeType.Collocation),
		components: z
			.array(CollocationComponentSchema)
			.min(2)
			.refine((arr) => arr.filter((c) => c.isAnchor === true).length === 1, {
				message: 'One component must have isAnchor: true',
			}),
		collocationType: CollocationTypeSchema,
		strength: CollocationStrengthSchema,
	})
	.extend(PhrasemeBaseSchema.shape);

export type Collocation = z.infer<typeof CollocationSchema>;

export const exampleCollocation = {
	type: 'Collocation',
	expression: 'triftige Gründe',
	components: [
		{
			lexem: 'triftige',
			baseForm: 'triftig',
			pos: 'Adjektiv',
		},
		{
			lexem: 'Gründe',
			baseForm: 'Grund',
			pos: 'Nomen',
			isAnchor: true,
		},
	],
	collocationType: 'AdjPlusNoun',
	strength: 'Bound',
} as const;
