// -- LinguisticUnitKindTag --

import z from "zod";
import { LinguisticUnitKind, SurfaceKind } from "../enums/core";

const LINGUISTIC_UNIT_KIND_TAGS_STR = ["LX", "PH", "MO"] as const;

export const LinguisticUnitKindTagSchema = z.enum(
	LINGUISTIC_UNIT_KIND_TAGS_STR,
);
export type LinguisticUnitKindTag = z.infer<typeof LinguisticUnitKindTagSchema>;
export const LinguisticUnitKindTag = LinguisticUnitKindTagSchema.enum;
export const LINGUISTIC_UNIT_KIND_TAGS = LinguisticUnitKindTagSchema.options;

export const linguisticUnitKindTagFrom: Record<
	LinguisticUnitKind,
	LinguisticUnitKindTag
> = {
	[LinguisticUnitKind.Lexem]: LinguisticUnitKindTag.LX,
	[LinguisticUnitKind.Phrasem]: LinguisticUnitKindTag.PH,
	[LinguisticUnitKind.Morphem]: LinguisticUnitKindTag.MO,
} as const satisfies Record<LinguisticUnitKind, LinguisticUnitKindTag>;

export const linguisticUnitKindFrom: Record<
	LinguisticUnitKindTag,
	LinguisticUnitKind
> = {
	[LinguisticUnitKindTag.LX]: LinguisticUnitKind.Lexem,
	[LinguisticUnitKindTag.PH]: LinguisticUnitKind.Phrasem,
	[LinguisticUnitKindTag.MO]: LinguisticUnitKind.Morphem,
} as const satisfies Record<LinguisticUnitKindTag, LinguisticUnitKind>;

// -- SurfaceKindTag --

const SURFACE_KIND_TAGS_STR = ["LM", "IN", "VA"] as const;

export const SurfaceKindTagSchema = z.enum(SURFACE_KIND_TAGS_STR);
export type SurfaceKindTag = z.infer<typeof SurfaceKindTagSchema>;
export const SurfaceKindTag = SurfaceKindTagSchema.enum;
export const SURFACE_KIND_TAGS = SurfaceKindTagSchema.options;

export const surfaceKindTagFrom: Record<SurfaceKind, SurfaceKindTag> = {
	[SurfaceKind.Lemma]: SurfaceKindTag.LM,
	[SurfaceKind.Inflected]: SurfaceKindTag.IN,
	[SurfaceKind.Variant]: SurfaceKindTag.VA,
} as const satisfies Record<SurfaceKind, SurfaceKindTag>;

export const surfaceKindFrom: Record<SurfaceKindTag, SurfaceKind> = {
	[SurfaceKindTag.LM]: SurfaceKind.Lemma,
	[SurfaceKindTag.IN]: SurfaceKind.Inflected,
	[SurfaceKindTag.VA]: SurfaceKind.Variant,
} as const satisfies Record<SurfaceKindTag, SurfaceKind>;
