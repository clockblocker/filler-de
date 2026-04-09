import z from "zod";

export const IsClosedSet = z.boolean();
export type IsClosedSet = z.infer<typeof IsClosedSet>;
export const IS_CLOSED_SET_KEY = "closedSet";

export function getReprForIsClosedSet(isClosedSet: IsClosedSet) {
	const reprForIsClosedSet = "closed set";

	return isClosedSet ? reprForIsClosedSet : `not ${reprForIsClosedSet}`;
}
