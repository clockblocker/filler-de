import { z } from "zod/v3";

export const HasGovPrep = z.string().min(1);
export type HasGovPrep = z.infer<typeof HasGovPrep>;
