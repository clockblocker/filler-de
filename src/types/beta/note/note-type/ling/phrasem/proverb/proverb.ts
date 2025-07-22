import z from 'zod/v4';
import { PhrasemeBaseSchema } from '../phrasem-base/phrasemBase';
import { PhrasemeType } from '../phrasem-base/phrasem-type/phrasemType';

export const ProverbSchema = z.object({
	type: z.literal(PhrasemeType.Proverb),
});

export type Proverb = z.infer<typeof ProverbSchema>;
