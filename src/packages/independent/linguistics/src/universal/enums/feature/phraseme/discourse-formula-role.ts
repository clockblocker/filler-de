import z from "zod/v3";

const discourseFormulaRoles = [
	"Greeting",
	"Farewell",
	"Apology",
	"Thanks",
	"Acknowledgment",
	"Refusal",
	"Request",
	"Reaction",
	"Initiation",
	"Transition",
] as const;

export const DiscourseFormulaRoleSchema = z.enum(discourseFormulaRoles);

export type DiscourseFormulaRole = z.infer<typeof DiscourseFormulaRoleSchema>;
export const DiscourseFormulaRole = DiscourseFormulaRoleSchema.enum;
export const DISCOURSE_FORMULA_ROLES = DiscourseFormulaRoleSchema.options;
