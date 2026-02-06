import { err, ok, type Result } from "neverthrow";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
} from "../../types";

/** Check that attestation is available (from wikilink click or prior Lemma). */
export function checkAttestation(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	const hasAttestation =
		ctx.textfresserState.attestationForLatestNavigated ||
		ctx.textfresserState.latestLemmaResult?.attestation;

	if (!hasAttestation) {
		return err({
			kind: CommandErrorKind.NotEligible,
			reason: "No attestation context available — run Lemma or click a wikilink first",
		});
	}
	return ok(ctx);
}
