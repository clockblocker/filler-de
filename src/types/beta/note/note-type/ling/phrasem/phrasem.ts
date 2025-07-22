import z from 'zod/v4';
import { CollocationSchema } from './collocation/collocation';
import { PhrasemeType } from './phrasem-base/phrasem-type/phrasemType';
import { DiscourseFormulaSchema } from './discourse-formula/discourseFormula';
import { IdiomSchema } from './idiom/idiom';
import { ProverbSchema } from './proverb/proverb';
import { CulturalQuotationSchema } from './cultural-quotation/culturalQuotation';

export const PhrasemeSchema = z.discriminatedUnion('type', [
	IdiomSchema,
	ProverbSchema,
	CulturalQuotationSchema,
	CollocationSchema,
	DiscourseFormulaSchema,
]);

export type Phraseme = z.infer<typeof PhrasemeSchema>;
