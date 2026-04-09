import { z } from "zod/v3";

const foreignValues = ["Yes"] as const;

// Source: https://universaldependencies.org/u/feat/Foreign.html
export const Foreign = z.enum(foreignValues);
export type Foreign = z.infer<typeof Foreign>;

const foreignRepr = {
	Yes: "foreign",
} satisfies Record<Foreign, string>;

export function reprForForeign(foreign: Foreign) {
	return foreignRepr[foreign];
}
