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

import { err, ok, type Result, ResultAsync } from "neverthrow";
import type { WikilinkClickPayload } from "../../managers/obsidian/user-event-interceptor/events/click/wikilink-click/payload";
import {
	type EventHandler,
	HandlerOutcome,
} from "../../managers/obsidian/user-event-interceptor/types/handler";
import type {
	VaultAction,
	VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import { logger } from "../../utils/logger";
import { generateCommand } from "./commands/generate";
import {
	type CommandError,
	CommandErrorKind,
	type CommandFn,
	TextfresserCommandKind,
} from "./commands/types";
import {
	buildTextfresserContext,
	type ContextError,
	noClickError,
	type TextfresserContext,
} from "./context";
import { type FsError, FsErrorKind, readCurrentFile } from "./fs-utils";
import type { TextfresserState } from "./types";

export class Textfresser {
	private state: TextfresserState = { latestContext: null };

	constructor(private readonly vam: VaultActionManager) {}

	// ─── Commands ───

	/**
	 * Generate command - moves current file to sharded path and sets metadata.
	 */
	generate(): Promise<Result<void, CommandError>> {
		return this.executeCommand(
			TextfresserCommandKind.Generate,
			generateCommand,
		);
	}

	// ─── Command Executor ───

	private async executeCommand(
		kind: TextfresserCommandKind,
		commandFn: CommandFn,
	): Promise<Result<void, CommandError>> {
		const result = await (await readCurrentFile(this.vam))
			.mapErr((e) => this.mapFsError(e))
			.andThen((fs) => commandFn({ ...fs, state: this.state }))
			.asyncAndThen((actions) => this.dispatchActions(actions));

		if (result.isErr()) {
			logger.warn(
				`[Textfresser.${kind}] Failed:`,
				JSON.stringify(result.error),
			);
			return result;
		}

		logger.info(`[Textfresser.${kind}] Success`);
		return result;
	}

	// ─── Handlers ───

	/** EventHandler for UserEventInterceptor */
	createHandler(): EventHandler<WikilinkClickPayload> {
		return {
			doesApply: () => true,
			handle: (payload) => {
				// Update state with latest context
				const contextResult = buildTextfresserContext({
					basename: payload.splitPath.basename,
					blockContent: payload.blockContent,
					linkTarget: payload.linkTarget,
				});

				if (contextResult.isOk()) {
					this.state.latestContext = contextResult.value;
				}

				logger.info(
					"[Textfresser] Updated latestContext:",
					JSON.stringify(this.state.latestContext),
				);
				return { outcome: HandlerOutcome.Passthrough };
			},
		};
	}

	// ─── State Access ───

	/** Get the current state */
	getState(): TextfresserState {
		return this.state;
	}

	/** Get structured context from the latest wikilink click */
	getLatestContext(): Result<TextfresserContext, ContextError> {
		if (!this.state.latestContext) {
			return err(noClickError());
		}
		return ok(this.state.latestContext);
	}

	// ─── Private ───

	private dispatchActions(
		actions: VaultAction[],
	): ResultAsync<void, CommandError> {
		return new ResultAsync(
			this.vam.dispatch(actions).then((dispatchResult) => {
				if (dispatchResult.isErr()) {
					const reason = dispatchResult.error
						.map((e) => e.error)
						.join(", ");
					return err<void, CommandError>({
						kind: CommandErrorKind.DispatchFailed,
						reason,
					});
				}
				return ok<void, CommandError>(undefined);
			}),
		);
	}

	private mapFsError(fsError: FsError): CommandError {
		switch (fsError.kind) {
			case FsErrorKind.NoMdFile:
				return { kind: CommandErrorKind.NotMdFile };
			case FsErrorKind.ReadFailed:
				return { kind: CommandErrorKind.NotMdFile };
		}
	}
}
