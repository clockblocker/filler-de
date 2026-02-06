import type {
	LinguisticUnitKind,
	SurfaceKind,
} from "../../../../linguistics/common/enums/core";
import type { POS } from "../../../../linguistics/common/enums/linguistic-units/lexem/pos";
import type { Attestation } from "../../common/attestation/types";

export type LemmaResult = {
	linguisticUnit: LinguisticUnitKind;
	pos?: POS;
	surfaceKind: SurfaceKind;
	lemma: string;
	attestation: Attestation;
	/** null = new sense or first encounter */
	disambiguationResult: { matchedIndex: number } | null;
};
