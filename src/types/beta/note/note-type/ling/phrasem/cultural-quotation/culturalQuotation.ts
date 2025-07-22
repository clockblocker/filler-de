import z from 'zod/v4';
import { PhrasemeType } from '../phrasem-base/phrasem-type/phrasemType';
import { PhrasemeBaseSchema } from '../phrasem-base/phrasemBase';

export const CulturalQuotationSchema = z.object({
	type: z.literal(PhrasemeType.CulturalQuotation),
	source: z.string().optional(),
});

export type CulturalQuotation = z.infer<typeof CulturalQuotationSchema>;
