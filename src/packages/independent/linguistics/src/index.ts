import { lingIdApiForLanguage } from "./ling-id/public";
import type { LingIdApiFor } from "./ling-id/types";
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
	operationForLanguage,
	resolveUnresolvedSurfaceWithLemma,
	toResolvedLemmaSurface,
	toStandardFullSelection,
	toStandardFullSelectionFromLemma,
	unresolveSurface,
} from "./lu/public-operations";

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
	forLanguage: operationForLanguage,
	resolve: {
		unresolvedSurface: {
			withLemma: resolveUnresolvedSurfaceWithLemma,
		},
	},
	unresolve: {
		surface: unresolveSurface,
	},
} as const;

export const LingIdCodec = {
	English: lingIdApiForLanguage("English"),
	forLanguage: lingIdApiForLanguage,
	German: lingIdApiForLanguage("German"),
	Hebrew: lingIdApiForLanguage("Hebrew"),
} satisfies {
	forLanguage<L extends TargetLanguage>(language: L): LingIdApiFor<L>;
} & {
	[L in TargetLanguage]: LingIdApiFor<L>;
};

import type { TargetLanguage } from "./lu/universal/enums/core/language";
import type { LingEntity } from "./lu/universal/enums/core/ling-entity";

export type {
	ConcreteLingIdKind,
	KnownSelection,
	LingId,
	LingIdDecodeError,
	LingIdDecodeErrorCode,
	LingIdValueFor,
} from "./ling-id/public";

export type {
	Lemma,
	ResolvedSurface,
	Selection,
	Surface,
	UnresolvedSurface,
} from "./lu/public-entities";

export * from "./relations/public";
