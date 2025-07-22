import z from 'zod/v4';
import { DiscourseFormulaRoleSchema } from './discourse-formula-role/discourseFormulaRole';
import { PhrasemeType } from '../phrasem-base/phrasem-type/phrasemType';
import { PhrasemeBaseSchema } from '../phrasem-base/phrasemBase';

export const DiscourseFormulaSchema = z
	.object({
		type: z.literal(PhrasemeType.DiscourseFormula),
		role: DiscourseFormulaRoleSchema,
	})
	.extend(PhrasemeBaseSchema.shape);

export type DiscourseFormula = z.infer<typeof DiscourseFormulaSchema>;
