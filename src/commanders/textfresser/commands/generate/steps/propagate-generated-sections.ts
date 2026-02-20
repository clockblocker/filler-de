import type { Result } from "neverthrow";
import type { CommandError } from "../../types";
import { decorateAttestationSeparability } from "./decorate-attestation-separability";
import type { GenerateSectionsResult } from "./generate-sections";
import { propagateCore } from "./propagate-core";

export function propagateGeneratedSections(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	return propagateCore(ctx).andThen(decorateAttestationSeparability);
}
