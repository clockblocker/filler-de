import { z } from "zod/v3";
import type { TargetLanguage } from "../../../../../types";

const DICT_SECTION_KIND_STR = [
	"Relation",
	"FreeForm",
	"Attestation",
	"Morphem",
	"Morphology",
	"Header",
	"Deviation",
	"Inflection",
	"Translation",
	"Tags",
] as const;

export const DictSectionKindSchema = z.enum(DICT_SECTION_KIND_STR);
export type DictSectionKind = z.infer<typeof DictSectionKindSchema>;
export const DictSectionKind = DictSectionKindSchema.enum;
export const ALL_DICT_SECTION_KINDS = DictSectionKindSchema.options;

/** Display title for each section kind, per target language. */
export const TitleReprFor = {
	[DictSectionKind.Relation]: {
		English: "Relations",
		German: "Semantische Beziehungen",
	},
	[DictSectionKind.FreeForm]: { English: "Notes", German: "Notizen" },
	[DictSectionKind.Attestation]: { English: "Contexts", German: "Kontexte" },
	[DictSectionKind.Morphem]: { English: "Morphemes", German: "Morpheme" },
	[DictSectionKind.Morphology]: {
		English: "Morphological Relations",
		German: "Morphologische Relationen",
	},
	[DictSectionKind.Header]: { English: "Forms", German: "Formen" },
	[DictSectionKind.Deviation]: {
		English: "Deviations",
		German: "Abweichungen",
	},
	[DictSectionKind.Inflection]: { English: "Inflection", German: "Flexion" },
	[DictSectionKind.Translation]: {
		English: "Translation",
		German: "Übersetzung",
	},
	[DictSectionKind.Tags]: { English: "Tags", German: "Tags" },
} satisfies Record<DictSectionKind, Record<TargetLanguage, string>>;
