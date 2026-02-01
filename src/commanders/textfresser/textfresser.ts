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
import { generateCommand } from "./commands/generate/generate-command";
import { type CommandInput, TextfresserCommandKind } from "./commands/types";
import { buildAttestationFromWikilinkClickPayload } from "./common/attestation/builders/build-from-wikilink-click-payload";
import type { Attestation } from "./common/attestation/types";
import {
	type FsError,
	FsErrorKind,
	readCurrentFile,
} from "./common/fs-utils/read-current-file";
import { type CommandError, CommandErrorKind } from "./errors";

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
	async generate(): Promise<Result<void, CommandError>> {
		const attestation = this.state.attestationForLatestNavigated;
		if (!attestation) {
			return err({
				kind: CommandErrorKind.NotEligible,
				reason: "No attestation context available",
			});
		}

		const fsResult = await readCurrentFile(this.vam);
		if (fsResult.isErr()) {
			return err(this.mapFsError(fsResult.error));
		}

		const { splitPath, content } = fsResult.value;
		const input: CommandInput<typeof TextfresserCommandKind.Generate> = {
			attestation,
			currentFileInfo: { content, path: splitPath },
			kind: TextfresserCommandKind.Generate,
			resultingActions: [],
		};

		const commandResult = generateCommand(input);
		if (commandResult.isErr()) {
			logger.warn(
				"[Textfresser.Generate] Failed:",
				JSON.stringify(commandResult.error),
			);
			return err(commandResult.error);
		}

		const dispatchResult = await this.dispatchActions(commandResult.value);
		if (dispatchResult.isErr()) {
			logger.warn(
				"[Textfresser.Generate] Dispatch failed:",
				JSON.stringify(dispatchResult.error),
			);
			return dispatchResult;
		}

		logger.info("[Textfresser.Generate] Success");
		return ok(undefined);
	}

	/**
	 * Lemma command - Out of scope
	 */
	lemma(): Promise<Result<void, CommandError>> {
		return Promise.resolve(ok(undefined));
	}

	/**
	 * TranslateSelection command - Out of scope
	 */
	translateSelection(): Promise<Result<void, CommandError>> {
		return Promise.resolve(ok(undefined));
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
	getState(): TextfresserState {
		return this.state;
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
