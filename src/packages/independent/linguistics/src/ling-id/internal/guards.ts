import z from "zod/v3";
import {
	LemmaSchema,
	ResolvedSurfaceSchema,
	SelectionSchema,
	SurfaceSchema,
} from "../../lu/public-entities";
import type { TargetLanguage } from "../../lu/universal/enums/core/language";
import type { ConcreteLingIdKind } from "../types";

function isZodSchema(value: unknown): value is z.ZodTypeAny {
	return value instanceof z.ZodType;
}

function collectLeafSchemas(value: unknown): z.ZodTypeAny[] {
	if (isZodSchema(value)) {
		return [value];
	}

	if (typeof value !== "object" || value === null) {
		return [];
	}

	return Object.values(value).flatMap((entry) => collectLeafSchemas(entry));
}

function unionLeafSchemas(value: unknown): z.ZodTypeAny {
	const leaves = collectLeafSchemas(value);

	if (leaves.length === 0) {
		throw new Error("Expected at least one schema leaf");
	}

	if (leaves.length === 1) {
		const onlyLeaf = leaves[0];

		if (onlyLeaf === undefined) {
			throw new Error("Expected exactly one schema leaf");
		}

		return onlyLeaf;
	}

	const [first, second, ...rest] = leaves;

	return z.union([first, second, ...rest] as [
		z.ZodTypeAny,
		z.ZodTypeAny,
		...z.ZodTypeAny[],
	]);
}

function hasResolvedTarget(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		"target" in value &&
		typeof (value as { target: unknown }).target === "object" &&
		(value as { target: object | null }).target !== null &&
		"lemmaKind" in ((value as { target: object }).target as object)
	);
}

function buildUnresolvedSurfaceSchema(language: TargetLanguage): z.ZodTypeAny {
	return unionLeafSchemas(SurfaceSchema[language]).superRefine(
		(value, ctx) => {
			if (hasResolvedTarget(value)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						"Unresolved surfaces require a canonical-lemma target",
					path: ["target"],
				});
			}
		},
	);
}

const runtimeSchemas = {
	English: {
		Lemma: unionLeafSchemas(LemmaSchema.English),
		ResolvedSurface: unionLeafSchemas(ResolvedSurfaceSchema.English),
		Selection: unionLeafSchemas({
			Standard: SelectionSchema.English.Standard,
			Typo: SelectionSchema.English.Typo,
		}),
		UnresolvedSurface: buildUnresolvedSurfaceSchema("English"),
	},
	German: {
		Lemma: unionLeafSchemas(LemmaSchema.German),
		ResolvedSurface: unionLeafSchemas(ResolvedSurfaceSchema.German),
		Selection: unionLeafSchemas({
			Standard: SelectionSchema.German.Standard,
			Typo: SelectionSchema.German.Typo,
		}),
		UnresolvedSurface: buildUnresolvedSurfaceSchema("German"),
	},
	Hebrew: {
		Lemma: unionLeafSchemas(LemmaSchema.Hebrew),
		ResolvedSurface: unionLeafSchemas(ResolvedSurfaceSchema.Hebrew),
		Selection: unionLeafSchemas({
			Standard: SelectionSchema.Hebrew.Standard,
			Typo: SelectionSchema.Hebrew.Typo,
		}),
		UnresolvedSurface: buildUnresolvedSurfaceSchema("Hebrew"),
	},
} satisfies {
	[L in TargetLanguage]: Record<ConcreteLingIdKind, z.ZodTypeAny>;
};

export function getRuntimeSchema(
	language: TargetLanguage,
	kind: ConcreteLingIdKind,
): z.ZodTypeAny {
	return runtimeSchemas[language][kind];
}

export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasResolvedSurfaceTarget(value: unknown): boolean {
	return (
		isPlainObject(value) &&
		"lemmaKind" in value &&
		typeof value.lemmaKind === "string"
	);
}
