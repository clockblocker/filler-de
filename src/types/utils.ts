import { err, ok, type Result } from "neverthrow";
import type { NonEmptyArray } from "./helpers";

export const nonEmptyArrayResult = <T>(xs: T[]): Result<NonEmptyArray<T>, string> => {
	const [first, ...rest] = xs;
	if (first == null) return err("Empty array");
	return ok([first, ...rest]);
};
