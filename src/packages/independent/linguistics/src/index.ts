import {
	LemmaSchema,
	ResolvedSurfaceSchema,
	SelectionSchema,
	SurfaceSchema,
	UnresolvedSurfaceSchema,
} from "./lu/public-entities";
import {
	extractLemmaFromSurface,
	extractSurfaceFromSelection,
	forLanguage,
	toResolvedLemmaSurface,
	toStandardFullSelection,
	toStandardFullSelectionFromLemma,
} from "./lu/public-operations";

import type { TargetLanguage } from "./lu/universal/enums/core/language";
import type { LingEntity } from "./lu/universal/enums/core/ling-entity";

export const lingSchemaFor = {
	Lemma: LemmaSchema,
	ResolvedSurface: ResolvedSurfaceSchema,
	Selection: SelectionSchema,
	Surface: SurfaceSchema,
	UnresolvedSurface: UnresolvedSurfaceSchema,
} satisfies {
	[Entity in LingEntity]: {
		[Language in TargetLanguage]: unknown;
	};
};

export const LingSchemaFor = lingSchemaFor;
export {
	LemmaSchema,
	ResolvedSurfaceSchema,
	SelectionSchema,
	SurfaceSchema,
	UnresolvedSurfaceSchema,
};

export const lingOperation = {
	convert: {
		lemma: {
			toResolvedLemmaSurface,
			toStandardFullSelection: toStandardFullSelectionFromLemma,
		},
		surface: {
			toStandardFullSelection,
		},
	},
	extract: {
		lemma: {
			fromSurface: extractLemmaFromSurface,
		},
		surface: {
			fromSelection: extractSurfaceFromSelection,
		},
	},
	forLanguage,
} as const;

export const LingOperation = lingOperation;

export * from "./ling-id/public";
export type {
	Lemma,
	ResolvedSurface,
	Selection,
	Surface,
	UnresolvedSurface,
} from "./lu/public-entities";

export * from "./relations/public";
