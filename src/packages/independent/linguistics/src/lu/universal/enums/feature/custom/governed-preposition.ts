import { z } from "zod/v3";

export const GovernedPreposition = z.string().min(1);
export type GovernedPreposition = z.infer<typeof GovernedPreposition>;

