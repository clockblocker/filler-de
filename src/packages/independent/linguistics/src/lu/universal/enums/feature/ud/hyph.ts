import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Hyph.html
export const Hyph = z.literal("Yes");
export type Hyph = z.infer<typeof Hyph>;
