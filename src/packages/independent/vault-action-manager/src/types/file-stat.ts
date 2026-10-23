import { Effect, Option, Predicate } from "effect";
import { z } from "zod";

/**
 * Obsidian's cached file stat: epoch milliseconds and bytes.
 *
 * A startup index can key cached entries by `(path, mtime)` and skip reading
 * files whose modification time did not change.
 */
export type VaultFileStat = {
	readonly ctime: number;
	readonly mtime: number;
	readonly size: number;
};

/** Any number, as Obsidian reports it: unlike `z.number()`, `NaN` and infinities pass. */
const anyNumber = z.custom<number>(Predicate.isNumber, {
	message: "Expected a number",
});

const VaultFileStatSchema = z.object({
	ctime: anyNumber,
	mtime: anyNumber,
	size: anyNumber,
});

/** Decodes and copies a live `TFile.stat`, which Obsidian mutates in place. */
export const decodeFileStat = (
	input: unknown,
): Effect.Effect<VaultFileStat, z.ZodError> =>
	Effect.suspend(() => {
		const parsed = VaultFileStatSchema.safeParse(input);
		return parsed.success
			? Effect.succeed(parsed.data)
			: Effect.fail(parsed.error);
	});

export const decodeFileStatOption = (
	input: unknown,
): Option.Option<VaultFileStat> => {
	const parsed = VaultFileStatSchema.safeParse(input);
	return parsed.success ? Option.some(parsed.data) : Option.none();
};
