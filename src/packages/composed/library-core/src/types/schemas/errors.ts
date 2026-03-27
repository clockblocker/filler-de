import z from "zod";

const NamingErrorSchema = z.enum(["EmptyNodeName", "DelimiterInNodeName"]);

export type NamingError = z.infer<typeof NamingErrorSchema>;
export const NamingError = NamingErrorSchema.enum;
