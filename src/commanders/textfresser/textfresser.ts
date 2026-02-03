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

import { err, ok, ResultAsync } from "neverthrow";
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
import { logger } from "../../utils/logger";
import { generateCommand } from "./commands/generate/generate-command";
import { translateCommand } from "./commands/translate/translate-command";
import {
	type CommandFn,
	type CommandInput,
	TextfresserCommandKind,
} from "./commands/types";
import { buildAttestationFromWikilinkClickPayload } from "./common/attestation/builders/build-from-wikilink-click-payload";
import type { Attestation } from "./common/attestation/types";
import { CommandErrorKind } from "./errors";

// ─── State ───

type TextfresserState = {
	attestationForLatestNavigated: Attestation | null;
};

export class Textfresser {
	private state: TextfresserState = {
		attestationForLatestNavigated: null,
	};

	constructor(private readonly vam: VaultActionManager) {}

	// ─── Commands ───

	/**
	 * Generate command - moves current file to sharded path and sets metadata.
	 */
	async generate(context: CommandContext) {
		if (!context.activeFile) {
			return err({ kind: CommandErrorKind.NotMdFile });
		}

		const attestation = this.state.attestationForLatestNavigated;
		if (!attestation) {
			return err({
				kind: CommandErrorKind.NotEligible,
				reason: "No attestation context available",
			});
		}

		const { splitPath, content } = context.activeFile;
		const input = {
			attestation,
			currentFileInfo: { content, path: splitPath },
			kind: TextfresserCommandKind.Generate,
			resultingActions: [],
		};

		return this.executeCommand("Generate", input, generateCommand);
	}

	/**
	 * Lemma command - Out of scope
	 */
	lemma(_context: CommandContext) {
		return Promise.resolve(ok(undefined));
	}

	/**
	 * TranslateSelection command - translates selected text.
	 */
	async translateSelection(context: CommandContext) {
		if (!context.activeFile) {
			return err({ kind: CommandErrorKind.NotMdFile });
		}

		const selection = context.selection?.text;
		if (!selection) {
			return err({ kind: CommandErrorKind.NoSelection });
		}

		const { splitPath, content } = context.activeFile;
		const input = {
			currentFileInfo: { content, path: splitPath },
			kind: TextfresserCommandKind.TranslateSelection,
			resultingActions: [],
			selection,
		};

		return this.executeCommand(
			"TranslateSelection",
			input,
			translateCommand,
		);
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

	private executeCommand<K extends TextfresserCommandKind>(
		commandName: K,
		input: CommandInput<K>,
		commandFn: CommandFn<K>,
	) {
		return new ResultAsync(Promise.resolve(commandFn(input)))
			.andThen((actions) => this.dispatchActions(actions))
			.map(() => logger.info(`[Textfresser.${commandName}] Success`))
			.mapErr((e) => {
				logger.warn(
					`[Textfresser.${commandName}] Failed:`,
					JSON.stringify(e),
				);
				return e;
			});
	}

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
