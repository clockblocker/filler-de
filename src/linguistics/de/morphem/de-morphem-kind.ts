import { z } from "zod/v3";
import { MorphemeKind } from "../../common/enums/linguistic-units/morphem/morpheme-kind";

const GERMAN_MORPHEME_KIND_VALUES = [
	MorphemeKind.Root,
	MorphemeKind.Prefix,
	MorphemeKind.Suffix,
	MorphemeKind.Suffixoid,
	MorphemeKind.Circumfix,
	MorphemeKind.Interfix,
	MorphemeKind.Duplifix,
] as const;

export const GermanMorphemeKindSchema = z.enum(GERMAN_MORPHEME_KIND_VALUES);
export type GermanMorphemeKind = z.infer<typeof GermanMorphemeKindSchema>;
export const GERMAN_MORPHEME_KINDS = GermanMorphemeKindSchema.options;
