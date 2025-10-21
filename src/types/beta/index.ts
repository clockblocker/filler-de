import { z } from "zod";

const GenerateLiteralSchema = z.literal("Generate");
export const GENERATE = GenerateLiteralSchema.value;

const SetupActionsLiteralSchema = z.literal("SetupActions");
export const SETUP_ACTIONS = SetupActionsLiteralSchema.value;
// export type GENERATE = z.infer<typeof GenerateLiteralSchema>;

export const THETA_ROLES_STR = [GENERATE, SETUP_ACTIONS] as const;

export const ThetaRoleSchema = z.enum(THETA_ROLES_STR);
export type ThetaRole = z.infer<typeof ThetaRoleSchema>;
export const ThetaRole = ThetaRoleSchema.enum;
export const THETA_ROLES = ThetaRoleSchema.options;
