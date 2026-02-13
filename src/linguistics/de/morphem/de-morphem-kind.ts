import { MORPHEME_KINDS } from "../../common/enums/linguistic-units/morphem/morpheme-kind";

type SpecializedKind = "Prefix";
type StubKind = Exclude<(typeof MORPHEME_KINDS)[number], SpecializedKind>;

/** All morpheme kinds except those with specialized features (Prefix). */
export const GERMAN_MORPHEM_KIND_STUBS = MORPHEME_KINDS.filter(
	(k): k is StubKind => k !== "Prefix",
);
