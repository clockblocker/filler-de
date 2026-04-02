import type { Prettify } from "node_modules/zod/v4/core/util";
import type { LinguisticUnitKind, MorphemeKind } from "./common";

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
