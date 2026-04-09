import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Poss.html
export const IS_POSS_KEY = "poss";
export const IsPoss = z.boolean();
export type IsPoss = z.infer<typeof IsPoss>;

export function getReprForIsPoss(isPoss: IsPoss) {
	const reprForIsPoss = "possessive";

	return isPoss ? reprForIsPoss : `not ${reprForIsPoss}`;
}

export const PossPart = z.object({ [IS_POSS_KEY]: IsPoss });
