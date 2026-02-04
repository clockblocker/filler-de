/**
 * Textfresser commander - thin orchestrator for vocabulary commands.
 *
 * Responsibilities:
 * - Hold state (latestContext from wikilink clicks)
 * - Read file context via fs-utils
 * - Call pure command functions
 * - Dispatch actions via VAM
 * - Handle and log errors
 */

import { err, errAsync, ok, ResultAsync } from "neverthrow";
import type { CommandContext } from "../../managers/actions-manager/types";
import type { WikilinkClickPayload } from "../../managers/obsidian/user-event-interceptor/events";
import {
	type EventHandler,
	HandlerOutcome,
} from "../../managers/obsidian/user-event-interceptor/types/handler";
import type {
	VaultAction,
	VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import type { ApiService } from "../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../types";
import { logger } from "../../utils/logger";
import { generateCommand } from "./commands/generate/generate-command";
import { translateCommand } from "./commands/translate/translate-command";
import type { CommandFn, TextfresserCommandKind } from "./commands/types";
import { buildAttestationFromWikilinkClickPayload } from "./common/attestation/builders/build-from-wikilink-click-payload";
import type { Attestation } from "./common/attestation/types";
import { CommandErrorKind } from "./errors";
import { PromptRunner } from "./prompt-runner";

// ─── Command Function Mapping ───

function lemmaCommand(): ResultAsync<VaultAction[], never> {
	return ResultAsync.fromSafePromise(Promise.resolve([]));
}

const commandFnForCommandKind: Record<TextfresserCommandKind, CommandFn> = {
	Generate: generateCommand,
	Lemma: lemmaCommand,
	TranslateSelection: translateCommand,
};

// ─── State ───

export type TextfresserState = {
	attestationForLatestNavigated: Attestation | null;
	languages: LanguagesConfig;
	promptRunner: PromptRunner;
};

export class Textfresser {
	private state: TextfresserState;

	constructor(
		private readonly vam: VaultActionManager,
		languages: LanguagesConfig,
		apiService: ApiService,
	) {
		this.state = {
			attestationForLatestNavigated: null,
			languages,
			promptRunner: new PromptRunner(languages, apiService),
		};
	}

	// ─── Commands ───

	executeCommand(
		commandName: TextfresserCommandKind,
		context: CommandContext,
	) {
		if (!context.activeFile) {
			return errAsync({ kind: CommandErrorKind.NotMdFile });
		}

		const commandFn = commandFnForCommandKind[commandName];
		const input = {
			commandContext: { ...context, activeFile: context.activeFile },
			resultingActions: [],
			textfresserState: this.state,
		};

		return commandFn(input)
			.andThen((actions) => this.dispatchActions(actions))
			.map(() => undefined)
			.mapErr((e) => {
				logger.warn(
					`[Textfresser.${commandName}] Failed:`,
					JSON.stringify(e),
				);
				return e;
			});
	}

	// ─── Handlers ───

	/** EventHandler for UserEventInterceptor */
	createHandler(): EventHandler<WikilinkClickPayload> {
		return {
			doesApply: () => true,
			handle: (payload) => {
				// Update state with latest context
				const attestationResult =
					buildAttestationFromWikilinkClickPayload(payload);

				if (attestationResult.isOk()) {
					this.state.attestationForLatestNavigated =
						attestationResult.value;
				}

				return { outcome: HandlerOutcome.Passthrough };
			},
		};
	}

	// ─── State Access ───

	/** Get the current state */
	getState() {
		return this.state;
	}

	// ─── Private ───

	private dispatchActions(actions: VaultAction[]) {
		return new ResultAsync(
			this.vam.dispatch(actions).then((dispatchResult) => {
				if (dispatchResult.isErr()) {
					const reason = dispatchResult.error
						.map((e) => e.error)
						.join(", ");
					return err({
						kind: CommandErrorKind.DispatchFailed,
						reason,
					});
				}
				return ok(undefined);
			}),
		);
	}
}
