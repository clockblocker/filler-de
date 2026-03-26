export {
	LANGUAGE_ISO_CODE,
	LinguisticUnitKind,
	type LinguisticUnitKind,
	LinguisticUnitKindSchema,
	LINGUISTIC_UNIT_KINDS,
	SurfaceKind,
	type SurfaceKind,
	SurfaceKindSchema,
	SURFACE_KINDS,
} from "./internal/linguistics/common/enums/core";

export {
	MorphemeKind,
	type MorphemeKind,
	MorphemeKindSchema,
	MORPHEME_KINDS,
} from "./internal/linguistics/common/enums/linguistic-units/morphem/morpheme-kind";

export {
	PARTS_OF_SPEECH,
	PARTS_OF_SPEECH_STR,
	POS,
	type POS,
	POSSchema,
	POS_TAGS,
	POS_TAGS_STR,
	PosTag,
	type PosTag,
	PosTagSchema,
	posFormFromPosTag,
	posTagFormFromPos,
} from "./internal/linguistics/common/enums/linguistic-units/lexem/pos";
