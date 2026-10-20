/**
 * Textfresser commander: runs Translate on the active note.
 */

import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { Dumgen } from "dumgen";
import { Effect } from "effect";
import type { CommandContext } from "../../managers/obsidian/command-executor";
import type { LanguagesConfig } from "../../types";
import { logger } from "../../utils/logger";
import { translateCommand } from "./commands/translate/translate-command";
import type { CommandError, TextfresserCommandKind } from "./commands/types";
import { CommandErrorKind } from "./errors";
import { dispatchActions } from "./orchestration/shared/dispatch-actions";
import type { TextfresserState } from "./state/textfresser-state";

export class Textfresser {
	private readonly state: TextfresserState;

	constructor(
		private readonly vam: VaultActionManager,
		languages: LanguagesConfig,
		getDumgen: () => Dumgen,
	) {
		this.state = { getDumgen, languages };
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
			Effect.flatMap((actions) => dispatchActions(this.vam, actions)),
			Effect.tapError((error) =>
				Effect.sync(() => {
					const reason =
						"reason" in error
							? error.reason
							: `Command failed: ${error.kind}`;
					notify(`⚠ ${reason}`);
					logger.warn(`[Textfresser.${commandName}] Failed:`, error);
				}),
			),
		);
	}
}
