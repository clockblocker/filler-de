import { DictSectionKind } from "./section-kind";

/** Maps DictSectionKind to its CSS suffix used in `entry_section_title_{suffix}`. */
export const cssSuffixFor: Record<DictSectionKind, string> = {
	[DictSectionKind.Header]: "formen",
	[DictSectionKind.Attestation]: "kontexte",
	[DictSectionKind.FreeForm]: "notizen",
	[DictSectionKind.Relation]: "synonyme",
	[DictSectionKind.Morphem]: "morpheme",
	[DictSectionKind.Morphology]: "morphologie",
	[DictSectionKind.Deviation]: "abweichungen",
	[DictSectionKind.Inflection]: "flexion",
	[DictSectionKind.Translation]: "translations",
	[DictSectionKind.Tags]: "tags",
};
