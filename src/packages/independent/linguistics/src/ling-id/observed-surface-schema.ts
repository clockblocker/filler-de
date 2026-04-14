import z, { type ZodTypeAny } from "zod/v3";
import { LemmaSchema } from "../lu/public";
import type { LemmaSchemaLanguageShape } from "../lu/registry-shapes";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import type { ObservedSurface } from "./types";

type ObservedSurfaceSchemaLanguageShape = {
	[LK in keyof LemmaSchemaLanguageShape]: {
		[D in keyof LemmaSchemaLanguageShape[LK]]: z.ZodType<ObservedSurface>;
	};
};

type ObservedSurfaceSchemaShape = {
	[L in TargetLanguage]: ObservedSurfaceSchemaLanguageShape;
};

export const ObservedSurfaceSchema = {
	English: buildObservedSurfaceSchemaForLanguage("English", LemmaSchema.English),
	German: buildObservedSurfaceSchemaForLanguage("German", LemmaSchema.German),
} satisfies ObservedSurfaceSchemaShape;

function buildObservedSurfaceSchemaForLanguage(
	language: TargetLanguage,
	lemmaSchema: LemmaSchemaLanguageShape,
): ObservedSurfaceSchemaLanguageShape {
	return Object.fromEntries(
		Object.entries(lemmaSchema).map(([lemmaKind, discriminators]) => [
			lemmaKind,
			Object.fromEntries(
				Object.entries(discriminators).map(
					([discriminator, schema]) => [
						discriminator,
						buildObservedSurfaceSchema(
							language,
							lemmaKind,
							discriminator,
							schema,
						),
					],
				),
			),
		]),
	) as ObservedSurfaceSchemaLanguageShape;
}

function buildObservedSurfaceSchema(
	language: TargetLanguage,
	lemmaKind: string,
	discriminator: string,
	lemmaSchema: ZodTypeAny,
): z.ZodType<ObservedSurface> {
	return z
		.object({
			discriminators: z.object({
				lemmaKind: z.literal(lemmaKind),
				lemmaSubKind: z.literal(discriminator),
			}),
			language: z.literal(language),
			lingKind: z.literal("Surface"),
			normalizedFullSurface: z.string(),
			observedLemma: z.custom<ObservedSurface["observedLemma"]>(
				(value) => isObservedLemmaDto(value) && lemmaSchema.safeParse(value).success,
			),
			orthographicStatus: z.literal("Standard"),
			surfaceKind: z.literal("Lemma"),
			target: z.literal("Lemma"),
		})
		.superRefine((value, ctx) => {
			const observedLemmaResult = lemmaSchema.safeParse(value.observedLemma);

			if (!observedLemmaResult.success) {
				return;
			}

			const observedLemma = observedLemmaResult.data;

			if (value.normalizedFullSurface !== observedLemma.canonicalLemma) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						"Observed surface normalizedFullSurface must match observedLemma.canonicalLemma",
					path: ["normalizedFullSurface"],
				});
			}

			if (
				value.discriminators.lemmaSubKind !==
				getLemmaSubKind(observedLemma)
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						"Observed surface discriminators must match observedLemma",
					path: ["discriminators", "lemmaSubKind"],
				});
			}
		});
}

function getLemmaSubKind(
	lemma: Exclude<ObservedSurface["observedLemma"], { lemmaKind: never }>,
): string {
	switch (lemma.lemmaKind) {
		case "Lexeme":
			return lemma.pos;
		case "Morpheme":
			return lemma.morphemeKind;
		case "Phraseme":
			return lemma.phrasemeKind;
	}
}

function isObservedLemmaDto(
	value: unknown,
): value is ObservedSurface["observedLemma"] {
	return (
		typeof value === "object" &&
		value !== null &&
		"lingKind" in value &&
		value.lingKind === "Lemma"
	);
}
