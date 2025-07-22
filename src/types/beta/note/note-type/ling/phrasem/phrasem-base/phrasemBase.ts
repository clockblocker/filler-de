import z from 'zod/v4';
import { PhrasemeType } from './phrasem-type/phrasemType';

export const PhrasemeBaseSchema = z.object({
	expression: z.string(),
	translation: z.string(),
	explanation: z.string(),
	analog: z.string().optional(),
});
