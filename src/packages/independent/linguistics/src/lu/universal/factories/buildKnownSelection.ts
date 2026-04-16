import z from "zod/v3";
import type { TargetLanguage } from "../enums/core/language";
import {
	type OrthographicStatus,
	SelectionCoverage,
	SpellingRelation,
} from "../enums/core/selection";

type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

type SelectionShapeFor<
	LanguageLiteral extends TargetLanguage,
	OrthographicStatusLiteral extends KnownOrthographicStatus,
	SurfaceSchema extends z.ZodTypeAny,
> = {
	language: z.ZodLiteral<LanguageLiteral>;
	orthographicStatus: z.ZodLiteral<OrthographicStatusLiteral>;
	spellingRelation: z.ZodOptional<typeof SpellingRelation>;
	spelledSelection: z.ZodString;
	selectionCoverage: typeof SelectionCoverage;
	surface: SurfaceSchema;
};

type StandardSelectionValueFor<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
> =
	| {
			language: LanguageLiteral;
			orthographicStatus: "Standard";
			spellingRelation?: z.infer<typeof SpellingRelation>;
			selectionCoverage: "Full";
			spelledSelection: string;
			surface: z.infer<SurfaceSchema>;
	  }
	| {
			language: LanguageLiteral;
			orthographicStatus: "Standard";
			spellingRelation?: z.infer<typeof SpellingRelation>;
			selectionCoverage: "Partial";
			spelledSelection: string;
			surface: z.infer<SurfaceSchema>;
	  };

type TypoSelectionValueFor<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
> = {
	language: LanguageLiteral;
	orthographicStatus: "Typo";
	spellingRelation?: z.infer<typeof SpellingRelation>;
	selectionCoverage: z.infer<typeof SelectionCoverage>;
	spelledSelection: string;
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
	shape: SelectionShapeFor<
		LanguageLiteral,
		OrthographicStatusLiteral,
		SurfaceSchema
	>;
};

export function buildKnownSelectionSchema<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
>(args: {
	orthographicStatus: KnownOrthographicStatus;
	spellingRelation?: z.infer<typeof SpellingRelation>;
	surface: {
		language: LanguageLiteral;
		schema: SurfaceSchema;
	};
}):
	| KnownSelectionSchemaFor<LanguageLiteral, "Standard", SurfaceSchema>
	| KnownSelectionSchemaFor<LanguageLiteral, "Typo", SurfaceSchema>;
export function buildKnownSelectionSchema<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
>(args: {
	orthographicStatus: "Standard";
	spellingRelation?: z.infer<typeof SpellingRelation>;
	surface: {
		language: LanguageLiteral;
		schema: SurfaceSchema;
	};
}): KnownSelectionSchemaFor<LanguageLiteral, "Standard", SurfaceSchema>;
export function buildKnownSelectionSchema<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
>(args: {
	orthographicStatus: "Typo";
	spellingRelation?: z.infer<typeof SpellingRelation>;
	surface: {
		language: LanguageLiteral;
		schema: SurfaceSchema;
	};
}): KnownSelectionSchemaFor<LanguageLiteral, "Typo", SurfaceSchema>;
export function buildKnownSelectionSchema<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
>({
	orthographicStatus,
	spellingRelation,
	surface,
}: {
	orthographicStatus: KnownOrthographicStatus;
	spellingRelation?: z.infer<typeof SpellingRelation>;
	surface: {
		language: LanguageLiteral;
		schema: SurfaceSchema;
	};
}) {
	const { language, schema: surfaceSchema } = surface;

	if (orthographicStatus === "Standard") {
		return buildStandardKnownSelectionSchema({
			language,
			spellingRelation,
			surfaceSchema,
		});
	}

	return buildTypoKnownSelectionSchema({
		language,
		spellingRelation,
		surfaceSchema,
	});
}

function buildStandardKnownSelectionSchema<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
>({
	language,
	spellingRelation,
	surfaceSchema,
}: {
	language: LanguageLiteral;
	spellingRelation?: z.infer<typeof SpellingRelation>;
	surfaceSchema: SurfaceSchema;
}): KnownSelectionSchemaFor<LanguageLiteral, "Standard", SurfaceSchema> {
	const spellingRelationSchema =
		spellingRelation === undefined
			? SpellingRelation.optional()
			: z.literal(spellingRelation).optional();
	const sharedShape = {
		language: z.literal(language),
		orthographicStatus: z.literal("Standard"),
		spellingRelation: spellingRelationSchema,
		spelledSelection: z.string(),
		surface: surfaceSchema,
	};

	const fullSchema = z
		.object({
			...sharedShape,
			selectionCoverage: z.literal("Full"),
		})
		.strict();
	const partialSchema = z
		.object({
			...sharedShape,
			selectionCoverage: z.literal("Partial"),
		})
		.strict();

	return withShape(z.union([fullSchema, partialSchema]), {
		...sharedShape,
		selectionCoverage: SelectionCoverage,
	}) as KnownSelectionSchemaFor<LanguageLiteral, "Standard", SurfaceSchema>;
}

function buildTypoKnownSelectionSchema<
	LanguageLiteral extends TargetLanguage,
	SurfaceSchema extends z.ZodTypeAny,
>({
	language,
	spellingRelation,
	surfaceSchema,
}: {
	language: LanguageLiteral;
	spellingRelation?: z.infer<typeof SpellingRelation>;
	surfaceSchema: SurfaceSchema;
}): KnownSelectionSchemaFor<LanguageLiteral, "Typo", SurfaceSchema> {
	const spellingRelationSchema =
		spellingRelation === undefined
			? SpellingRelation.optional()
			: z.literal(spellingRelation).optional();
	return z
		.object({
			language: z.literal(language),
			orthographicStatus: z.literal("Typo"),
			spellingRelation: spellingRelationSchema,
			selectionCoverage: SelectionCoverage,
			spelledSelection: z.string(),
			surface: surfaceSchema,
		})
		.strict() as KnownSelectionSchemaFor<
		LanguageLiteral,
		"Typo",
		SurfaceSchema
	>;
}

function withShape<
	Schema extends z.ZodTypeAny,
	Shape extends Record<string, z.ZodTypeAny>,
>(schema: Schema, shape: Shape): Schema & { shape: Shape } {
	return Object.assign(schema, { shape });
}
