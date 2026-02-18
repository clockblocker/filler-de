import type { Result } from "neverthrow";
import { decorateAttestationSeparability } from "./decorate-attestation-separability";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import { propagateV2 } from "./propagate-v2";

export function propagateGeneratedSections(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	return propagateV2(ctx).andThen(decorateAttestationSeparability);
}
