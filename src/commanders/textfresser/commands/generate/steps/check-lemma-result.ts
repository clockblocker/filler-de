import { err, ok, type Result } from "neverthrow";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
	type CommandStateWithLemma,
} from "../../types";

/** Check that lemma result is available (Lemma command must run first). */
export function checkLemmaResult(
	ctx: CommandState,
): Result<CommandStateWithLemma, CommandError> {
	if (!ctx.textfresserState.latestLemmaResult) {
		return err({
			kind: CommandErrorKind.NotEligible,
			reason: "No lemma result available — run Lemma command first",
		});
	}
	return ok(ctx as CommandStateWithLemma);
}
