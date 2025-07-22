import z from 'zod';
import { PhrasemeType } from '../phrasem-base/phrasem-type/phrasemType';
import { withPhrasemeBase } from '../phrasem-base/phrasemBase';

export const ProverbSchema = withPhrasemeBase(PhrasemeType.Proverb, {});
export type Proverb = z.infer<typeof ProverbSchema>;
