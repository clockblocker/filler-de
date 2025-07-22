import z from 'zod';
import { PhrasemeType } from '../phrasem-base/phrasem-type/phrasemType';
import { withPhrasemeBase } from '../phrasem-base/phrasemBase';

export const IdiomSchema = withPhrasemeBase(PhrasemeType.Idiom, {});
export type Idiom = z.infer<typeof IdiomSchema>;
