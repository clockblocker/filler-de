import { z } from "zod/v3";

export const IsSeparable = z.boolean();
export type IsSeparable = z.infer<typeof IsSeparable>;

export function getReprForIsSeparable(isSeparable: IsSeparable) {
	const reprForIsSeparable = "separable";

	return isSeparable ? reprForIsSeparable : `not ${reprForIsSeparable}`;
}
