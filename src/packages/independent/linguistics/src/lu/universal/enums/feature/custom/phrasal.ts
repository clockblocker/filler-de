import { z } from "zod/v3";

export const Phrasal = z.literal("Yes");
export type Phrasal = z.infer<typeof Phrasal>;

export function getReprForPhrasal(_phrasal: Phrasal) {
	const reprForPhrasal = "phrasal";

	return reprForPhrasal;
}
