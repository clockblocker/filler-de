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
import type { CommandContext } from "../../managers/obsidian/user-actions-manager";
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
import { commandFnForCommandKind } from "./commands";
import type { LemmaResult } from "./commands/lemma/types";
import type { TextfresserCommandKind } from "./commands/types";
import { buildAttestationFromWikilinkClickPayload } from "./common/attestation/builders/build-from-wikilink-click-payload";
import type { Attestation } from "./common/attestation/types";
import { CommandErrorKind } from "./errors";
import { PromptRunner } from "./prompt-runner";

// ─── State ───

export type TextfresserState = {
	attestationForLatestNavigated: Attestation | null;
	latestLemmaResult: LemmaResult | null;
	/** Section names that failed during the latest Generate command (optional sections only). */
	latestFailedSections: string[];
	/** Block ID of the entry to scroll to after Generate dispatch. */
	targetBlockId?: string;
	languages: LanguagesConfig;
	promptRunner: PromptRunner;
	vam: VaultActionManager;
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
			latestFailedSections: [],
			latestLemmaResult: null,
			promptRunner: new PromptRunner(languages, apiService),
			vam,
		};
	}

	// ─── Commands ───

	executeCommand(
		commandName: TextfresserCommandKind,
		context: CommandContext,
		notify: (message: string) => void,
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
			.map(() => {
				const lemma = this.state.latestLemmaResult;
				if (commandName === "Lemma" && lemma) {
					const pos = lemma.pos ? ` (${lemma.pos})` : "";
					notify(`✓ ${lemma.lemma}${pos}`);
				} else if (commandName === "Generate" && lemma) {
					const failed = this.state.latestFailedSections;
					if (failed?.length) {
						notify(
							`⚠ Entry created for ${lemma.lemma} (failed: ${failed.join(", ")})`,
						);
					} else {
						notify(`✓ Entry created for ${lemma.lemma}`);
					}
					this.scrollToTargetBlock();
				}
			})
			.mapErr((e) => {
				const reason =
					"reason" in e ? e.reason : `Command failed: ${e.kind}`;
				notify(`⚠ ${reason}`);
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

	/** Scroll the editor to the line containing ^{targetBlockId}. Fire-and-forget UX convenience. */
	private scrollToTargetBlock(): void {
		const blockId = this.state.targetBlockId;
		if (!blockId) return;
		this.state.targetBlockId = undefined;

		const contentResult = this.vam.activeFileService.getContent();
		if (contentResult.isErr()) return;

		const marker = `^${blockId}`;
		const lineIndex = contentResult.value
			.split("\n")
			.findIndex((line) => line.includes(marker));
		if (lineIndex < 0) return;

		this.vam.activeFileService.scrollToLine(lineIndex);
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
