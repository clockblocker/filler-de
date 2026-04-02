import type {
	LinguisticUnitKind,
	MorphemeKind,
} from "src/packages/independent/old-linguistics/src";
import type { Prettify } from "node_modules/zod/v4/core/util";

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
