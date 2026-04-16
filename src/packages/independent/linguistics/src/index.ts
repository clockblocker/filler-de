import {
	LemmaSchema,
	ResolvedSurfaceSchema,
	SelectionSchema,
	SurfaceSchema,
	UnresolvedSurfaceSchema,
} from "./lu/public-entities";
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

// const lingOperation = {
// 	convert: {
// 		surface: {
// 			toStandardFullSelection: // Surface -> Selection
// 		},
// 		lemma: {
// 			toResolvedSurfaceOfLemma: // Lemma -> ResolvedSurface<SurfaceKind = "Lemma">
// 			toStandardFullSelection: // chain lemma.toResolvedSurfaceOfLemma and surface.toStandardFullSelection
// 		},
// 	},
// 	extract: {
// 		lemma: {
// 			fromSurface: // ResolvedSurface -> Lemma; Surface -> Lemma | null; UnresolvedSurface -> null
// 		},
// 		surface: {
// 			fromSelection: // Selection -> Surface | null (null is when selection orph status is Unknown)
// 		}
// 	}
// }

export type {
	Lemma,
	ResolvedSurface,
	Selection,
	Surface,
	UnresolvedSurface,
} from "./lu/public-entities";

export * from "./old-ling-id/public";

export * from "./relations/public";
