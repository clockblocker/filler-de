import { err, ok, type Result } from "neverthrow";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
} from "../../types";

/** Check that attestation is available. */
export function checkAttestation(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	if (!ctx.textfresserState.attestationForLatestNavigated) {
		return err({
			kind: CommandErrorKind.NotEligible,
			reason: "No attestation context available",
		});
	}
	return ok(ctx);
}
