import z, { type ZodTypeAny } from "zod/v3";
import type { SurfaceSchemaLanguageShape } from "./registry-shapes";

export type ObservedSurfaceSchemaLanguageShape = {
	[OS in keyof SurfaceSchemaLanguageShape]: {
		[SK in keyof SurfaceSchemaLanguageShape[OS]]: {
			[LK in keyof SurfaceSchemaLanguageShape[OS][SK]]: {
				[D in keyof SurfaceSchemaLanguageShape[OS][SK][LK]]: z.ZodTypeAny;
			};
		};
	};
};

export function buildObservedSurfaceSchemaForLanguage(
	surfaceSchema: SurfaceSchemaLanguageShape,
): ObservedSurfaceSchemaLanguageShape {
	return Object.fromEntries(
		Object.entries(surfaceSchema).map(
			([orthographicStatus, surfaceKinds]) => [
				orthographicStatus,
				Object.fromEntries(
					Object.entries(surfaceKinds).map(
						([surfaceKind, lemmaKinds]) => [
							surfaceKind,
							Object.fromEntries(
								Object.entries(lemmaKinds).map(
									([lemmaKind, discriminators]) => [
										lemmaKind,
										Object.fromEntries(
											Object.entries(discriminators).map(
												([discriminator, schema]) => [
													discriminator,
													buildObservedSurfaceSchema(
														schema as ZodTypeAny,
													),
												],
											),
										),
									],
								),
							),
						],
					),
				),
			],
		),
	) as ObservedSurfaceSchemaLanguageShape;
}

function buildObservedSurfaceSchema(schema: ZodTypeAny): ZodTypeAny {
	return schema.superRefine((value, ctx) => {
		if (!hasObservedSurfaceTarget(value)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Observed surfaces require a full lemma target",
				path: ["target"],
			});
		}
	});
}

function hasObservedSurfaceTarget(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		"target" in value &&
		typeof (value as { target: unknown }).target === "object" &&
		(value as { target: object | null }).target !== null &&
		"lemmaKind" in ((value as { target: object }).target as object)
	);
}
