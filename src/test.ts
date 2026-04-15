import type {
	MorphemeKind,
} from "./deprecated-linguistic-enums";
import type { LinguisticUnitKind } from "./commanders/textfresser/domain/note-linguistic-policy";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

// Lemmas
type BaseLinguisticUnitMap = {
	[LUK in LinguisticUnitKind]: { lingUnitKind: LUK };
};

// type Lexeme = LinguisticUnitMap["Lexeme"];

type BaseMorphemMap = {
	[MK in MorphemeKind]: Prettify<
		{ morphemeKind: MK } & BaseLinguisticUnitMap["Morpheme"]
	>;
};

type Prefix = BaseMorphemMap["Prefix"];

// inherentFeatures: {} -- for lemmas
// inflectional: {} -- for flection
// relations: { }
