import z from "zod/v3";

export const SenseEmojisSchema = z
	.array(z.string().min(1).max(4))
	.min(1)
	.max(3);

export function withLegacySenseEmojisAlias<T extends z.ZodTypeAny>(
	schema: T,
): T {
	return z.preprocess((input) => {
		if (
			typeof input !== "object" ||
			input === null ||
			Array.isArray(input)
		) {
			return input;
		}

		const record = input as Record<string, unknown>;
		if (
			record.senseEmojis !== undefined ||
			record.emojiDescription === undefined
		) {
			return input;
		}

		return {
			...record,
			senseEmojis: record.emojiDescription,
		};
	}, schema) as unknown as T;
}
