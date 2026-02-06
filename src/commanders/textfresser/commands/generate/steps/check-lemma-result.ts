import { err, ok, type Result } from "neverthrow";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
} from "../../types";

/** Check that lemma result is available (Lemma command must run first). */
export function checkLemmaResult(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	if (!ctx.textfresserState.latestLemmaResult) {
		return err({
			kind: CommandErrorKind.NotEligible,
			reason: "No lemma result available — run Lemma command first",
		});
	}
	return ok(ctx);
}
