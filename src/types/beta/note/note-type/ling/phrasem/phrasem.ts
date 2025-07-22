import z from 'zod/v4';
import { CollocationSchema } from './collocation/collocation';
import { DiscourseFormulaSchema } from './discourse-formula/discourseFormula';
import { IdiomSchema } from './idiom/idiom';
import { ProverbSchema } from './proverb/proverb';
import { CulturalQuotationSchema } from './cultural-quotation/culturalQuotation';
import { PhrasemeBaseSchema } from './phrasem-base/phrasemBase';

export const PhrasemeSchema = z.discriminatedUnion('type', [
	IdiomSchema.extend(PhrasemeBaseSchema.shape),
	ProverbSchema.extend(PhrasemeBaseSchema.shape),
	CulturalQuotationSchema.extend(PhrasemeBaseSchema.shape),
	CollocationSchema.extend(PhrasemeBaseSchema.shape),
	DiscourseFormulaSchema.extend(PhrasemeBaseSchema.shape),
]);

export type Phraseme = z.infer<typeof PhrasemeSchema>;
