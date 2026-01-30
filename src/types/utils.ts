import { err, ok, type Result } from "neverthrow";
import type { NonEmptyArray } from "./helpers";

export const nonEmptyArrayResult = <T>(
	xs: T[] | null | undefined,
): Result<NonEmptyArray<T>, string> => {
	if (xs == null) return err("Null or undefined");
	const [first, ...rest] = xs;
	if (first == null) return err("Empty array");
	return ok([first, ...rest]);
};
