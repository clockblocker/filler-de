import type { Result } from "neverthrow";
import { decorateAttestationSeparability } from "./decorate-attestation-separability";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import { propagateInflections } from "./propagate-inflections";
import { propagateMorphemes } from "./propagate-morphemes";
import { propagateMorphologyRelations } from "./propagate-morphology-relations";
import { propagateRelations } from "./propagate-relations";
import { propagateV2 } from "./propagate-v2";

export function propagateGeneratedSections(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	if (ctx.textfresserState.propagationV2Enabled) {
		return propagateV2(ctx);
	}

	return propagateRelations(ctx)
		.andThen(propagateMorphologyRelations)
		.andThen(propagateMorphemes)
		.andThen(decorateAttestationSeparability)
		.andThen(propagateInflections);
}
