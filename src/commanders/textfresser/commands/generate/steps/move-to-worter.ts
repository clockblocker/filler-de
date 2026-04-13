import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import {
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { ok, type Result } from "neverthrow";
import { buildPolicyDestinationPath } from "../../../common/lemma-link-routing";
import type { CommandError, CommandStateWithLemma } from "../../types";

/** Appends RenameMdFile action to move file to the policy destination. */
export function moveToWorter(
	ctx: CommandStateWithLemma,
): Result<CommandStateWithLemma, CommandError> {
	const activeFile = ctx.commandContext.activeFile;
	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const destination = buildPolicyDestinationPath({
		lemma: lemmaResult.lemma,
		linguisticUnit: lemmaResult.linguisticUnit,
		posLikeKind:
			lemmaResult.linguisticUnit === "Lexeme"
				? lemmaResult.posLikeKind
				: null,
		surfaceKind: lemmaResult.surfaceKind,
		targetLanguage: ctx.textfresserState.languages.target,
	});

	// Skip rename if already at destination.
	const currentParts = activeFile.splitPath.pathParts;
	const alreadyAtDestination =
		activeFile.splitPath.basename === destination.basename &&
		currentParts.length === destination.pathParts.length &&
		currentParts.every(
			(part, index) => part === destination.pathParts[index],
		);

	if (alreadyAtDestination) {
		return ok(ctx);
	}

	const newPath: SplitPathToMdFile = destination;

	const action: VaultAction = {
		kind: VaultActionKind.RenameMdFile,
		payload: { from: activeFile.splitPath, to: newPath },
	};

	return ok({
		...ctx,
		actions: [...ctx.actions, action],
		commandContext: {
			...ctx.commandContext,
			activeFile: { ...activeFile, splitPath: newPath },
		},
	});
}
