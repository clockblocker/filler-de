import {
	LemmaSchema,
	ResolvedSurfaceSchema,
	SelectionSchema,
	SurfaceSchema,
	UnresolvedSurfaceSchema,
} from "./lu/public-entities";
import { LingOperation } from "./lu/public-operations";
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
export { LingOperation };

export type {
	Lemma,
	ResolvedSurface,
	Selection,
	Surface,
	UnresolvedSurface,
} from "./lu/public-entities";

export * from "./old-ling-id/public";

export * from "./relations/public";
