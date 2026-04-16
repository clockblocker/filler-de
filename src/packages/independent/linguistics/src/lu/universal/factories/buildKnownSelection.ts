import z from "zod/v3";
import type { TargetLanguage } from "../enums/core/language";
import {
	type OrthographicStatus,
	SelectionCoverage,
} from "../enums/core/selection";

type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

type StandardSelectionValueFor<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
> =
	| {
			language: LanguageLiteral;
			orthographicStatus: "Standard";
			spelledSelection: string;
			selectionCoverage: "Full";
			surface: z.infer<SurfaceSchema>;
	  }
	| {
			language: LanguageLiteral;
			orthographicStatus: "Standard";
			spelledSelection: string;
			selectionCoverage: "Partial";
			normalizedSelectedSurface: string;
			surface: z.infer<SurfaceSchema>;
	  };

type TypoSelectionValueFor<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
> = {
	language: LanguageLiteral;
	orthographicStatus: "Typo";
	spelledSelection: string;
	selectionCoverage: z.infer<typeof SelectionCoverage>;
	surface: z.infer<SurfaceSchema>;
};

export type KnownSelectionValueFor<
	LanguageLiteral extends TargetLanguage,
	OrthographicStatusLiteral extends KnownOrthographicStatus,
	SurfaceSchema extends z.ZodTypeAny,
> = OrthographicStatusLiteral extends "Standard"
	? StandardSelectionValueFor<LanguageLiteral, SurfaceSchema>
	: TypoSelectionValueFor<LanguageLiteral, SurfaceSchema>;

export type KnownSelectionSchemaFor<
	LanguageLiteral extends TargetLanguage,
	OrthographicStatusLiteral extends KnownOrthographicStatus,
	SurfaceSchema extends z.ZodTypeAny,
> = z.ZodType<
	KnownSelectionValueFor<
		LanguageLiteral,
		OrthographicStatusLiteral,
		SurfaceSchema
	>
> & {
	shape: {
		language: z.ZodLiteral<LanguageLiteral>;
		orthographicStatus: z.ZodLiteral<OrthographicStatusLiteral>;
		spelledSelection: z.ZodString;
		selectionCoverage: typeof SelectionCoverage;
		surface: SurfaceSchema;
		normalizedSelectedSurface?: z.ZodOptional<z.ZodString>;
	};
};

export function buildKnownSelectionSchema<
	LanguageLiteral extends TargetLanguage,
	OrthographicStatusLiteral extends KnownOrthographicStatus,
	SurfaceSchema extends z.ZodTypeAny,
>({
	language,
	orthographicStatus,
	surfaceSchema,
}: {
	language: LanguageLiteral;
	orthographicStatus: OrthographicStatusLiteral;
	surfaceSchema: SurfaceSchema;
}): KnownSelectionSchemaFor<
	LanguageLiteral,
	OrthographicStatusLiteral,
	SurfaceSchema
> {
	if (orthographicStatus === "Standard") {
		const baseSchema = z
			.object({
				language: z.literal(language),
				normalizedSelectedSurface: z.string().optional(),
				orthographicStatus: z.literal(orthographicStatus),
				selectionCoverage: SelectionCoverage,
				spelledSelection: z.string(),
				surface: surfaceSchema,
			})
			.strict()
			.strict();
		const refinedSchema = baseSchema.superRefine((selection, ctx) => {
			if (selection.selectionCoverage === "Full") {
				if (selection.normalizedSelectedSurface !== undefined) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message:
							'normalizedSelectedSurface must be omitted when selectionCoverage is "Full"',
						path: ["normalizedSelectedSurface"],
					});
				}
				return;
			}

			if (selection.normalizedSelectedSurface === undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message:
						'normalizedSelectedSurface is required when selectionCoverage is "Partial"',
					path: ["normalizedSelectedSurface"],
				});
			}
		});

		return Object.assign(refinedSchema, {
			shape: baseSchema.shape,
		}) as KnownSelectionSchemaFor<
			LanguageLiteral,
			OrthographicStatusLiteral,
			SurfaceSchema
		>;
	}

	return z
		.object({
			language: z.literal(language),
			orthographicStatus: z.literal(orthographicStatus),
			selectionCoverage: SelectionCoverage,
			spelledSelection: z.string(),
			surface: surfaceSchema,
		})
		.strict() as KnownSelectionSchemaFor<
		LanguageLiteral,
		OrthographicStatusLiteral,
		SurfaceSchema
	>;
}
