import z from "zod";

export const ChangePolicySchema = z.enum(["NameKing", "PathKing"]);
export const ChangePolicy = ChangePolicySchema.enum;
export type ChangePolicy = z.infer<typeof ChangePolicySchema>;
