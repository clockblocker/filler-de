import z from 'zod/v4';
import { PhrasemeType } from './phrasem-type/phrasemType';

export const PhrasemeBaseSchema = z.object({
	expression: z.string(),
	translation: z.string(),
	explanation: z.string(),
	analog: z.string().optional(),
});

export const withPhrasemeBase = <T extends z.ZodRawShape>(
	type: PhrasemeType,
	shape: T
) =>
	z
		.object({ type: z.literal(type) })
		.extend({ ...PhrasemeBaseSchema.shape, ...shape });
