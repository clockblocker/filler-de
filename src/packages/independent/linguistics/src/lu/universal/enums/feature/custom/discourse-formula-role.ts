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

type DiscourseFormulaRole = z.infer<typeof DiscourseFormulaRoleSchema>;
const DiscourseFormulaRole = DiscourseFormulaRoleSchema.enum;
const DISCOURSE_FORMULA_ROLES = DiscourseFormulaRoleSchema.options;
