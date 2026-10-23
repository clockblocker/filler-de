/**
 * Textfresser commander: runs Translate on the active note, as one dumgen
 * action.
 */

import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { Cause, Effect } from "effect";
import type { DumgenProvide } from "../../managers/dumgen";
import type { CommandContext } from "../../managers/obsidian/command-executor";
import type { LanguagesConfig } from "../../types";
import { getErrorMessage } from "../../utils/get-error-message";
import {
	translateCommand,
	translationFailed,
} from "./commands/translate/translate-command";
import type { CommandError, TextfresserCommandKind } from "./commands/types";
import { CommandErrorKind } from "./errors";
import { dispatchActions } from "./orchestration/shared/dispatch-actions";
import type { TextfresserState } from "./state/textfresser-state";

export class Textfresser {
	private readonly state: TextfresserState;

	constructor(
		private readonly vam: VaultActionManager,
		languages: LanguagesConfig,
		/** `Dumgen.provide`. */
		private readonly dumgen: DumgenProvide,
	) {
		this.state = { languages };
	}

	executeCommand(
		commandName: TextfresserCommandKind,
		context: CommandContext,
		notify: (message: string) => void,
	): Effect.Effect<void, CommandError> {
		if (!context.activeFile) {
			return Effect.fail({ kind: CommandErrorKind.NotMdFile });
		}

		return translateCommand({
			commandContext: { ...context, activeFile: context.activeFile },
			textfresserState: this.state,
		}).pipe(
			this.dumgen,
			Effect.catchTag("DumgenUnavailable", (error) =>
				Effect.fail(translationFailed(getErrorMessage(error.cause))),
			),
			Effect.flatMap((actions) => dispatchActions(this.vam, actions)),
			Effect.tapError((error) =>
				Effect.sync(() => {
					const reason =
						"reason" in error
							? error.reason
							: `Command failed: ${error.kind}`;
					notify(`⚠ ${reason}`);
				}).pipe(
					Effect.andThen(
						Effect.logWarning(
							`[Textfresser.${commandName}] Failed:`,
							Cause.fail(error),
						),
					),
				),
			),
		);
	}
}
