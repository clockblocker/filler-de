import { z } from "zod/v3";

// Source: https://universaldependencies.org/he/index.html
export const HebExistential = z.literal("Yes");
export type HebExistential = z.infer<typeof HebExistential>;
