import { z } from "zod/v3";

export const IsSeparable = z.boolean();
export type IsSeparable = z.infer<typeof IsSeparable>;
export const IS_SEPARABLE_KEY = "separable";

export function getReprForIsSeparable(isSeparable: IsSeparable) {
	const reprForIsSeparable = "separable";

	return isSeparable ? reprForIsSeparable : `not ${reprForIsSeparable}`;
}
