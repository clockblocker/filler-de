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
import type { CommandContext } from "../../managers/obsidian/command-executor";
import type { WikilinkClickPayload } from "../../managers/obsidian/user-event-interceptor/events";
import {
	type EventHandler,
	HandlerOutcome,
} from "../../managers/obsidian/user-event-interceptor/types/handler";
import {
	type VaultAction,
	VaultActionKind,
	type VaultActionManager,
} from "../../managers/obsidian/vault-action-manager";
import type { ApiService } from "../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../types";
import { logger } from "../../utils/logger";
import { commandFnForCommandKind } from "./commands";
import type { LemmaResult } from "./commands/lemma/types";
import type { CommandInput, TextfresserCommandKind } from "./commands/types";
import { buildAttestationFromWikilinkClickPayload } from "./common/attestation/builders/build-from-wikilink-click-payload";
import type { Attestation } from "./common/attestation/types";
import { computeShardedFolderParts } from "./common/sharded-path";
import type { PathLookupFn } from "./common/target-path-resolver";
import { CommandErrorKind } from "./errors";
import { PromptRunner } from "./prompt-runner";

// ─── State ───

export type InFlightGenerate = {
	lemma: string;
	promise: Promise<void>;
};

export type TextfresserState = {
	attestationForLatestNavigated: Attestation | null;
	latestLemmaResult: LemmaResult | null;
	/** Section names that failed during the latest Generate command (optional sections only). */
	latestFailedSections: string[];
	/** Block ID of the entry to scroll to after Generate dispatch. */
	targetBlockId?: string;
	/** Background Generate in progress (set after successful Lemma). */
	inFlightGenerate: InFlightGenerate | null;
	languages: LanguagesConfig;
	/** Lookup files in Librarian's corename index (set after Librarian init). */
	lookupInLibrary: PathLookupFn;
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
			inFlightGenerate: null,
			languages,
			latestFailedSections: [],
			latestLemmaResult: null,
			lookupInLibrary: () => [],
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

		const resultChain = commandFn(input)
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

		if (commandName === "Lemma") {
			return resultChain.map(() => {
				this.fireBackgroundGenerate(notify);
			});
		}
		return resultChain;
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

				// If background Generate is in flight for this target, wait and scroll after navigation
				const inFlight = this.state.inFlightGenerate;
				if (
					inFlight &&
					payload.wikiTarget.basename === inFlight.lemma
				) {
					void this.awaitGenerateAndScroll(inFlight);
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

	/** Wire librarian corename lookup (called after Librarian init). */
	setLibrarianLookup(fn: PathLookupFn): void {
		this.state.lookupInLibrary = fn;
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

	/** Fire-and-forget: launch background Generate after successful Lemma. */
	private fireBackgroundGenerate(notify: (message: string) => void): void {
		if (this.state.inFlightGenerate) return;

		const lemma = this.state.latestLemmaResult;
		if (!lemma) return;

		const promise = this.runBackgroundGenerate(lemma.lemma, notify)
			.catch((e) => {
				const reason = e instanceof Error ? e.message : String(e);
				logger.warn("[Textfresser.backgroundGenerate] Failed:", reason);
				notify(`⚠ Background generate failed: ${reason}`);
			})
			.finally(() => {
				this.state.inFlightGenerate = null;
			});

		this.state.inFlightGenerate = { lemma: lemma.lemma, promise };
	}

	/** Run the Generate pipeline for a target note without navigating to it. */
	private async runBackgroundGenerate(
		lemma: string,
		notify: (message: string) => void,
	): Promise<void> {
		// 1. Find existing file or construct sharded Worter path for new file
		const existingPaths = this.vam.findByBasename(lemma);
		const lemmaResult = this.state.latestLemmaResult;
		const targetPath = existingPaths[0] ?? {
			basename: lemma,
			extension: "md" as const,
			kind: "MdFile" as const,
			pathParts: lemmaResult
				? computeShardedFolderParts(
						lemma,
						this.state.languages.target,
						lemmaResult.linguisticUnit,
						lemmaResult.surfaceKind,
					)
				: ([] as string[]),
		};

		// 2. Read content (empty string if file doesn't exist yet)
		const contentResult = await this.vam.readContent(targetPath);
		const content = contentResult.isOk() ? contentResult.value : "";

		// 3. Build synthetic command input
		const input: CommandInput = {
			commandContext: {
				activeFile: { content, splitPath: targetPath },
				selection: null,
			},
			resultingActions: [],
			textfresserState: this.state,
		};

		// 4. Run generate pipeline
		const generateResult = await commandFnForCommandKind.Generate(input);
		if (generateResult.isErr()) {
			const error = generateResult.error;
			const reason =
				"reason" in error
					? error.reason
					: `Command failed: ${error.kind}`;
			throw new Error(reason);
		}

		// 5. Prepend UpsertMdFile to ensure file exists before process/rename
		const upsertAction: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { splitPath: targetPath },
		};
		const allActions = [upsertAction, ...generateResult.value];

		// 6. Dispatch
		const dispatchResult = await this.vam.dispatch(allActions);
		if (dispatchResult.isErr()) {
			const reason = dispatchResult.error.map((e) => e.error).join(", ");
			throw new Error(reason);
		}

		// 7. Notify success (don't scroll — user isn't viewing the target file)
		const failed = this.state.latestFailedSections;
		if (failed?.length) {
			notify(
				`⚠ Entry created for ${lemma} (failed: ${failed.join(", ")})`,
			);
		} else {
			notify(`✓ Entry created for ${lemma}`);
		}
	}

	/** Wait for in-flight Generate to finish, then scroll to the entry if user is on the target note. */
	private async awaitGenerateAndScroll(
		inFlight: InFlightGenerate,
	): Promise<void> {
		try {
			await inFlight.promise;
		} catch {
			return; // Generate already logged/notified the error
		}

		// Let openLinkText navigation settle
		await new Promise((resolve) => setTimeout(resolve, 300));

		// Only scroll if user is still viewing the target note
		const currentFile = this.vam.mdPwd();
		if (!currentFile || currentFile.basename !== inFlight.lemma) return;

		this.scrollToTargetBlock();
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
