import z from 'zod/v4';

const DEFINED_DISCOURSE_FORMULA_ROLES_STR = [
	'Greeting',
	'Farewell',
	'Apology',
	'Thanks',
	'Acknowledgment',
	'Refusal',
	'Request',
	'Reaction',
	'Initiation',
	'Transition',
] as const;

export const DefinedDiscourseFormulaRoleSchema = z.enum(
	DEFINED_DISCOURSE_FORMULA_ROLES_STR
);

export type DefinedDiscourseFormulaRole = z.infer<
	typeof DefinedDiscourseFormulaRoleSchema
>;

export const DefinedDiscourseFormulaRole =
	DefinedDiscourseFormulaRoleSchema.enum;

export const DEFINED_DISCOURSE_FORMULA_ROLES =
	DefinedDiscourseFormulaRoleSchema.options;

export const DiscourseFormulaRoleSchema = DefinedDiscourseFormulaRoleSchema.or(
	z.string()
);

export type DiscourseFormulaRole = z.infer<typeof DiscourseFormulaRoleSchema>;
