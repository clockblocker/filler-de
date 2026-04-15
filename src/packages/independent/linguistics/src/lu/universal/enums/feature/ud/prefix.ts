import { z } from "zod/v3";

// Source: https://universaldependencies.org/he/index.html
export const Prefix = z.literal("Yes");
export type Prefix = z.infer<typeof Prefix>;
