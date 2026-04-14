import { z } from "zod/v3";

// Source: https://universaldependencies.org/u/feat/Foreign.html
export const IsForeign = z.boolean();
export type IsForeign = z.infer<typeof IsForeign>;

export function getReprForIsForeign(isForeign: IsForeign) {
	const reprForIsForeign = "foreign";

	return isForeign ? reprForIsForeign : `not ${reprForIsForeign}`;
}
