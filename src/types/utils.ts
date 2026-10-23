import { Result } from "effect";
import type { NonEmptyArray } from "./helpers";

export const nonEmptyArrayResult = <T>(
	xs: T[] | null | undefined,
): Result.Result<NonEmptyArray<T>, string> => {
	if (xs == null) return Result.fail("Null or undefined");
	const [first, ...rest] = xs;
	if (first == null) return Result.fail("Empty array");
	return Result.succeed([first, ...rest]);
};
