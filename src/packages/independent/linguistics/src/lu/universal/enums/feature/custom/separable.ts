import { z } from "zod/v3";

export const HasSepPrefix = z.string().min(1);
export type HasSepPrefix = z.infer<typeof HasSepPrefix>;

export function getReprForHasSepPrefix(_hasSepPrefix: HasSepPrefix) {
	const reprForHasSepPrefix = "has separable prefix";

	return reprForHasSepPrefix;
}
