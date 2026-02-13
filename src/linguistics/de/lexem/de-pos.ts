import { PARTS_OF_SPEECH_STR } from "../../common/enums/linguistic-units/lexem/pos";

type SpecializedPOS = "Noun";
type StubPOS = Exclude<(typeof PARTS_OF_SPEECH_STR)[number], SpecializedPOS>;

/** All POS values except those with specialized features (Noun). */
export const GERMAN_POS_STUBS = PARTS_OF_SPEECH_STR.filter(
	(p): p is StubPOS => p !== "Noun",
);
