import { ok, type Result } from "neverthrow";
import { buildClosedSetSurfaceHubActions } from "../../../common/closed-set-surface-hub";
import { isClosedSetPos } from "../../../common/lemma-link-routing";
import type { CommandError, CommandStateWithLemma } from "../../types";

export function maintainClosedSetSurfaceHub(
	ctx: CommandStateWithLemma,
): Result<CommandStateWithLemma, CommandError> {
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	if (lemmaResult.linguisticUnit !== "Lexem") {
		return ok(ctx);
	}
	if (!isClosedSetPos(lemmaResult.posLikeKind)) {
		return ok(ctx);
	}
	if (!ctx.textfresserState.isLibraryLookupAvailable) {
		return ok(ctx);
	}

	const actions = buildClosedSetSurfaceHubActions({
		currentClosedSetTarget: ctx.commandContext.activeFile.splitPath,
		lookupInLibrary: ctx.textfresserState.lookupInLibrary,
		surface: lemmaResult.attestation.target.surface,
		targetLanguage: ctx.textfresserState.languages.target,
		vam: ctx.textfresserState.vam,
	});

	if (actions.length === 0) {
		return ok(ctx);
	}

	return ok({
		...ctx,
		actions: [...ctx.actions, ...actions],
	});
}
