import z from 'zod/v4';
import { PhrasemeBaseSchema } from '../phrasem-base/phrasemBase';
import { PhrasemeType } from '../phrasem-base/phrasem-type/phrasemType';

export const IdiomSchema = z.object({
	type: z.literal(PhrasemeType.Idiom),
});

export type Idiom = z.infer<typeof IdiomSchema>;
