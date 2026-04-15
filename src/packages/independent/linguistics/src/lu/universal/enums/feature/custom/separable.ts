import { z } from "zod/v3";

export const Separable = z.literal("Yes");
export type Separable = z.infer<typeof Separable>;

export function getReprForSeparable(_separable: Separable) {
	const reprForSeparable = "separable";

	return reprForSeparable;
}
