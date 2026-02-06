import type {
	LinguisticUnitKind,
	SurfaceKind,
} from "../../../../linguistics/enums/core";
import type { POS } from "../../../../linguistics/enums/linguistic-units/lexem/pos";
import type { Attestation } from "../../common/attestation/types";

export type LemmaResult = {
	linguisticUnit: LinguisticUnitKind;
	pos?: POS;
	surfaceKind: SurfaceKind;
	lemma: string;
	attestation: Attestation;
};
