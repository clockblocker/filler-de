import type {
	MorphemeKind,
} from "@textfresser/linguistics";
import type { LinguisticUnitKind } from "./commanders/textfresser/domain/note-linguistic-policy";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

// Lemmas
type BaseLinguisticUnitMap = {
	[LUK in LinguisticUnitKind]: { lingUnitKind: LUK };
};

// type Lexem = LinguisticUnitMap["Lexem"];

type BaseMorphemMap = {
	[MK in MorphemeKind]: Prettify<
		{ morphemeKind: MK } & BaseLinguisticUnitMap["Morphem"]
	>;
};

type Prefix = BaseMorphemMap["Prefix"];

// inherentFeatures: {} -- for lemmas
// inflectional: {} -- for flection
// relations: { }
