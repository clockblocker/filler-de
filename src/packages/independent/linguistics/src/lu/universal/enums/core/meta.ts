import z from "zod";

export const IsClosedSet = z.boolean();
export type IsClosedSet = z.infer<typeof IsClosedSet>;

function getReprForIsClosedSet(isClosedSet: IsClosedSet) {
	const reprForIsClosedSet = "closed set";

	return isClosedSet ? reprForIsClosedSet : `not ${reprForIsClosedSet}`;
}
