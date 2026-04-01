import type { MorphemeKind } from "@textfresser/lexical-generation";
import type { Prettify } from "node_modules/zod/v4/core/util";
import type { LinguisticUnitKind } from "./packages/independent/linguistics/src/common/enums/core";

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
