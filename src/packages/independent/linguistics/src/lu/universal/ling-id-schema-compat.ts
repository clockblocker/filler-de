import z from "zod/v3";
import type { TargetLanguage } from "./enums/core/language";
import type { OrthographicStatus } from "./enums/core/selection";

export function withLingIdLemmaDtoCompatibility<T extends z.ZodTypeAny>(
	schema: T,
): T {
	return z.preprocess(
		(input) =>
			stripLingIdMetadata(input, {
				expectedLingKind: "Lemma",
				keys: ["lingKind"],
			}),
		schema,
	) as unknown as T;
}

export function withLingIdSurfaceDtoCompatibility<T extends z.ZodTypeAny>({
	language,
	orthographicStatus,
	schema,
}: {
	language: TargetLanguage;
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
	schema: T;
}): T {
	return z.preprocess(
		(input) =>
			stripLingIdMetadata(input, {
				expectedLanguage: language,
				expectedLingKind: "Surface",
				expectedOrthographicStatus: orthographicStatus,
				keys: ["language", "lingKind", "orthographicStatus"],
			}),
		schema,
	) as unknown as T;
}

function stripLingIdMetadata(
	input: unknown,
	{
		expectedLanguage,
		expectedLingKind,
		expectedOrthographicStatus,
		keys,
	}: {
		expectedLanguage?: TargetLanguage;
		expectedLingKind: "Lemma" | "Surface";
		expectedOrthographicStatus?: Exclude<OrthographicStatus, "Unknown">;
		keys: readonly string[];
	},
): unknown {
	if (!isPlainObject(input)) {
		return input;
	}

	if (input.lingKind !== expectedLingKind) {
		return input;
	}

	if (expectedLanguage !== undefined && input.language !== expectedLanguage) {
		return input;
	}

	if (
		expectedOrthographicStatus !== undefined &&
		input.orthographicStatus !== expectedOrthographicStatus
	) {
		return input;
	}

	const stripped = { ...input };

	for (const key of keys) {
		delete stripped[key];
	}

	return stripped;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
