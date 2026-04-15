import { z } from "zod/v3";

export const IsPhrasal = z.boolean();
export type IsPhrasal = z.infer<typeof IsPhrasal>;

export function getReprForIsPhrasal(isPhrasal: IsPhrasal) {
	const reprForIsPhrasal = "phrasal";

	return isPhrasal ? reprForIsPhrasal : `not ${reprForIsPhrasal}`;
}
