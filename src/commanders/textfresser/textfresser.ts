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

import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
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
import type { SplitPathToMdFile } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { PromptKind } from "../../prompt-smith/codegen/consts";
import type { ApiService } from "../../stateless-helpers/api-service";
import { markdownHelper } from "../../stateless-helpers/markdown-strip";
import { multiSpanHelper } from "../../stateless-helpers/multi-span";
import type { LanguagesConfig } from "../../types";
import { logger } from "../../utils/logger";
import { commandFnForCommandKind } from "./commands";
import {
	buildWikilinkForTarget,
	expandOffsetForLinkedSpan,
	resolveAttestation,
	rewriteAttestationSourceContent,
} from "./commands/lemma/lemma-command";
import { disambiguateSense } from "./commands/lemma/steps/disambiguate-sense";
import type { LemmaResult } from "./commands/lemma/types";
import type {
	CommandError,
	CommandInput,
	TextfresserCommandKind,
} from "./commands/types";
import { buildAttestationFromWikilinkClickPayload } from "./common/attestation/builders/build-from-wikilink-click-payload";
import type { Attestation } from "./common/attestation/types";
import {
	buildPolicyDestinationPath,
	computeFinalTarget,
	computePrePromptTarget,
} from "./common/lemma-link-routing";
import type { PathLookupFn } from "./common/target-path-resolver";
import { CommandErrorKind } from "./errors";
import { PromptRunner } from "./llm/prompt-runner";

// ─── State ───

export type InFlightGenerate = {
	lemma: string;
	targetPath: SplitPathToMdFile;
	promise: Promise<void>;
};

export type TextfresserState = {
	attestationForLatestNavigated: Attestation | null;
	latestLemmaResult: LemmaResult | null;
	latestResolvedLemmaTargetPath?: SplitPathToMdFile;
	latestLemmaPlaceholderPath?: SplitPathToMdFile;
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

type RewritePlan = {
	updatedBlock: string;
	wikilink: string;
	replaceOffsetInBlock?: number;
	replaceSurface?: string;
};

function areSameSplitPath(a: SplitPathToMdFile, b: SplitPathToMdFile): boolean {
	return (
		a.basename === b.basename &&
		a.extension === b.extension &&
		a.pathParts.length === b.pathParts.length &&
		a.pathParts.every((part, index) => part === b.pathParts[index])
	);
}

function buildUpdatedBlock(
	rawBlock: string,
	offset: number | undefined,
	surface: string,
	wikilink: string,
): string {
	if (offset === undefined) {
		return rawBlock.replace(surface, wikilink);
	}

	return (
		rawBlock.slice(0, offset) +
		wikilink +
		rawBlock.slice(offset + surface.length)
	);
}

function buildLemmaRewritePlan(params: {
	attestation: Attestation;
	contextWithLinkedParts?: string;
	linkTarget: string;
}): RewritePlan {
	const { attestation, contextWithLinkedParts, linkTarget } = params;
	const rawBlock = attestation.source.textRaw;
	const surface = attestation.target.surface;
	const offset = attestation.target.offsetInBlock;

	let updatedBlock: string | null = null;
	let replaceSurface = surface;
	let replaceOffsetInBlock = offset ?? undefined;

	if (contextWithLinkedParts && offset !== undefined) {
		const stripped = multiSpanHelper.stripBrackets(contextWithLinkedParts);
		const expectedStripped = markdownHelper.stripAll(rawBlock);

		if (stripped === expectedStripped) {
			const spans = multiSpanHelper.parseBracketedSpans(
				contextWithLinkedParts,
			);

			if (spans.length > 1) {
				const resolved = multiSpanHelper.mapSpansToRawBlock(
					rawBlock,
					spans,
					surface,
					offset,
				);
				if (resolved && resolved.length > 1) {
					updatedBlock = multiSpanHelper.applyMultiSpanReplacement(
						rawBlock,
						resolved,
						linkTarget,
					);
					attestation.source.textWithOnlyTargetMarked =
						contextWithLinkedParts;
				}
			}

			if (updatedBlock === null && spans.length === 1) {
				const span = spans[0];
				if (span && span.text !== surface) {
					const expanded = expandOffsetForLinkedSpan(
						rawBlock,
						surface,
						offset,
						span.text,
					);
					if (expanded.replaceSurface !== surface) {
						replaceSurface = expanded.replaceSurface;
						replaceOffsetInBlock = expanded.replaceOffset;
						updatedBlock = buildUpdatedBlock(
							rawBlock,
							expanded.replaceOffset,
							expanded.replaceSurface,
							buildWikilinkForTarget(
								expanded.replaceSurface,
								linkTarget,
							),
						);
						attestation.source.textWithOnlyTargetMarked =
							contextWithLinkedParts;
					}
				}
			}
		} else {
			logger.warn(
				"[lemma] contextWithLinkedParts stripped text mismatch — falling back to single-span",
			);
		}
	}

	const wikilink = buildWikilinkForTarget(replaceSurface, linkTarget);
	return {
		replaceOffsetInBlock,
		replaceSurface,
		updatedBlock:
			updatedBlock ??
			buildUpdatedBlock(
				rawBlock,
				replaceOffsetInBlock,
				replaceSurface,
				wikilink,
			),
		wikilink,
	};
}

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

		if (commandName === "Lemma") {
			return this.executeLemmaCommand(
				{
					...context,
					activeFile: context.activeFile,
				},
				notify,
			);
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
				if (commandName === "Generate" && lemma) {
					const failed = this.state.latestFailedSections;
					if (failed.length > 0) {
						notify(
							`⚠ Entry created for ${lemma.lemma} (failed: ${failed.join(", ")})`,
						);
					} else {
						notify(`✓ Entry created for ${lemma.lemma}`);
					}
					this.scrollToTargetBlock();
				}
			})
			.mapErr((error) => {
				const reason =
					"reason" in error
						? error.reason
						: `Command failed: ${error.kind}`;
				notify(`⚠ ${reason}`);
				logger.warn(`[Textfresser.${commandName}] Failed:`, error);
				return error;
			});
	}

	// ─── Handlers ───

	/** EventHandler for UserEventInterceptor */
	createHandler(): EventHandler<WikilinkClickPayload> {
		return {
			doesApply: () => true,
			handle: (payload) => {
				const attestationResult =
					buildAttestationFromWikilinkClickPayload(payload);

				if (attestationResult.isOk()) {
					this.state.attestationForLatestNavigated =
						attestationResult.value;
				}

				const inFlight = this.state.inFlightGenerate;
				if (inFlight) {
					const clickedTarget = this.vam.resolveLinkpathDest(
						payload.wikiTarget.basename,
						payload.splitPath,
					);
					const isInFlightTarget = clickedTarget
						? areSameSplitPath(clickedTarget, inFlight.targetPath)
						: payload.wikiTarget.basename ===
							inFlight.targetPath.basename;
					if (isInFlightTarget) {
						void this.awaitGenerateAndScroll(inFlight);
					}
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

	private executeLemmaCommand(
		context: CommandContext & {
			activeFile: NonNullable<CommandContext["activeFile"]>;
		},
		notify: (message: string) => void,
	) {
		const input: CommandInput = {
			commandContext: context,
			resultingActions: [],
			textfresserState: this.state,
		};

		return new ResultAsync(this.runLemmaTwoPhase(input))
			.map(() => {
				const lemma = this.state.latestLemmaResult;
				if (!lemma) return;

				const pos =
					lemma.linguisticUnit === "Lexem"
						? ` (${lemma.posLikeKind})`
						: "";
				notify(`✓ ${lemma.lemma}${pos}`);
				this.fireBackgroundGenerate(notify);
			})
			.mapErr((error) => {
				const reason =
					"reason" in error
						? error.reason
						: `Command failed: ${error.kind}`;
				notify(`⚠ ${reason}`);
				logger.warn("[Textfresser.Lemma] Failed:", error);
				return error;
			});
	}

	private async runLemmaTwoPhase(
		input: CommandInput,
	): Promise<Result<void, CommandError>> {
		const attestation = resolveAttestation(input);
		if (!attestation) {
			return err({
				kind: CommandErrorKind.NotEligible,
				reason: "No attestation context available — select a word or click a wikilink first",
			});
		}

		const surface = attestation.target.surface;
		const prePromptTarget = computePrePromptTarget({
			lookupInLibrary: this.state.lookupInLibrary,
			resolveLinkpathDest: (linkpath, from) =>
				this.vam.resolveLinkpathDest(linkpath, from),
			sourcePath: attestation.source.path,
			surface,
			targetLanguage: this.state.languages.target,
		});
		const placeholderPath = prePromptTarget.shouldCreatePlaceholder
			? prePromptTarget.splitPath
			: null;
		this.state.latestLemmaPlaceholderPath = placeholderPath ?? undefined;

		const rawBlock = attestation.source.textRaw;
		const offsetInBlock = attestation.target.offsetInBlock ?? undefined;
		const temporaryWikilink = buildWikilinkForTarget(
			surface,
			prePromptTarget.linkTarget,
		);
		const phaseAActions: VaultAction[] = [
			...(placeholderPath
				? [
						{
							kind: VaultActionKind.UpsertMdFile,
							payload: { splitPath: placeholderPath },
						} as const,
					]
				: []),
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath: attestation.source.path,
					transform: (content: string) =>
						rewriteAttestationSourceContent({
							content,
							offsetInBlock,
							rawBlock,
							surface,
							updatedBlock: buildUpdatedBlock(
								rawBlock,
								offsetInBlock,
								surface,
								temporaryWikilink,
							),
							wikilink: temporaryWikilink,
						}),
				},
			},
		];

		const phaseADispatch = await this.dispatchActions(phaseAActions);
		if (phaseADispatch.isErr()) {
			return err(phaseADispatch.error);
		}

		const context = attestation.source.textWithOnlyTargetMarked;
		const lemmaPromptResult = await this.state.promptRunner.generate(
			PromptKind.Lemma,
			{ context, surface },
		);
		if (lemmaPromptResult.isErr()) {
			return err({
				kind: CommandErrorKind.ApiError,
				reason: lemmaPromptResult.error.reason,
			});
		}
		const lemmaPromptOutput = lemmaPromptResult.value;

		const finalTarget = computeFinalTarget({
			findByBasename: (basename) => this.vam.findByBasename(basename),
			lemma: lemmaPromptOutput.lemma,
			linguisticUnit: lemmaPromptOutput.linguisticUnit,
			lookupInLibrary: this.state.lookupInLibrary,
			posLikeKind:
				lemmaPromptOutput.linguisticUnit === "Lexem"
					? lemmaPromptOutput.posLikeKind
					: null,
			surfaceKind: lemmaPromptOutput.surfaceKind,
			targetLanguage: this.state.languages.target,
		});

		const disambiguation =
			lemmaPromptOutput.linguisticUnit === "Lexem"
				? await disambiguateSense(
						this.vam,
						this.state.promptRunner,
						{
							lemma: lemmaPromptOutput.lemma,
							linguisticUnit: "Lexem",
							pos: lemmaPromptOutput.posLikeKind,
							surfaceKind: lemmaPromptOutput.surfaceKind,
						},
						context,
						finalTarget.splitPath,
					)
				: await disambiguateSense(
						this.vam,
						this.state.promptRunner,
						{
							lemma: lemmaPromptOutput.lemma,
							linguisticUnit: "Phrasem",
							phrasemeKind: lemmaPromptOutput.posLikeKind,
							surfaceKind: lemmaPromptOutput.surfaceKind,
						},
						context,
						finalTarget.splitPath,
					);
		if (disambiguation.isErr()) {
			return err(disambiguation.error);
		}

		const disambiguationResult = disambiguation.value;
		const precomputedEmojiDescription =
			disambiguationResult &&
			"precomputedEmojiDescription" in disambiguationResult
				? disambiguationResult.precomputedEmojiDescription
				: undefined;
		const normalizedDisambiguation =
			disambiguationResult === null ||
			disambiguationResult.matchedIndex === null
				? null
				: { matchedIndex: disambiguationResult.matchedIndex };

		if (lemmaPromptOutput.linguisticUnit === "Lexem") {
			this.state.latestLemmaResult = {
				attestation,
				disambiguationResult: normalizedDisambiguation,
				lemma: lemmaPromptOutput.lemma,
				linguisticUnit: "Lexem",
				posLikeKind: lemmaPromptOutput.posLikeKind,
				precomputedEmojiDescription,
				surfaceKind: lemmaPromptOutput.surfaceKind,
			};
		} else {
			this.state.latestLemmaResult = {
				attestation,
				disambiguationResult: normalizedDisambiguation,
				lemma: lemmaPromptOutput.lemma,
				linguisticUnit: "Phrasem",
				posLikeKind: lemmaPromptOutput.posLikeKind,
				precomputedEmojiDescription,
				surfaceKind: lemmaPromptOutput.surfaceKind,
			};
		}
		this.state.latestResolvedLemmaTargetPath = finalTarget.splitPath;

		const rewritePlan = buildLemmaRewritePlan({
			attestation,
			contextWithLinkedParts:
				lemmaPromptOutput.contextWithLinkedParts ?? undefined,
			linkTarget: finalTarget.linkTarget,
		});

		const currentPath = this.vam.mdPwd();
		const shouldNavigateToFinal =
			placeholderPath !== null &&
			currentPath !== null &&
			!areSameSplitPath(placeholderPath, finalTarget.splitPath) &&
			areSameSplitPath(currentPath, placeholderPath);

		let placeholderWasCleaned = false;
		let placeholderWasRenamed = false;
		const phaseBActions: VaultAction[] = [];

		if (
			placeholderPath &&
			!areSameSplitPath(placeholderPath, finalTarget.splitPath)
		) {
			const finalExists = this.vam.exists(finalTarget.splitPath);
			if (!finalExists) {
				phaseBActions.push({
					kind: VaultActionKind.RenameMdFile,
					payload: {
						from: placeholderPath,
						to: finalTarget.splitPath,
					},
				});
				placeholderWasCleaned = true;
				placeholderWasRenamed = true;
			} else {
				const placeholderContentResult =
					await this.vam.readContent(placeholderPath);
				if (
					placeholderContentResult.isOk() &&
					placeholderContentResult.value.trim().length === 0
				) {
					phaseBActions.push({
						kind: VaultActionKind.TrashMdFile,
						payload: { splitPath: placeholderPath },
					});
					placeholderWasCleaned = true;
				}
			}
		}

		if (!placeholderWasRenamed && !this.vam.exists(finalTarget.splitPath)) {
			phaseBActions.push({
				kind: VaultActionKind.UpsertMdFile,
				payload: { splitPath: finalTarget.splitPath },
			});
		}

		phaseBActions.push({
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: attestation.source.path,
				transform: (content: string) =>
					rewriteAttestationSourceContent({
						content,
						offsetInBlock,
						rawBlock,
						replaceOffsetInBlock: rewritePlan.replaceOffsetInBlock,
						replaceSurface: rewritePlan.replaceSurface,
						surface,
						updatedBlock: rewritePlan.updatedBlock,
						wikilink: rewritePlan.wikilink,
					}),
			},
		});

		const phaseBDispatch = await this.dispatchActions(phaseBActions);
		if (phaseBDispatch.isErr()) {
			return err(phaseBDispatch.error);
		}

		this.state.latestLemmaPlaceholderPath = placeholderWasCleaned
			? undefined
			: (placeholderPath ?? undefined);

		if (shouldNavigateToFinal) {
			const cdResult = await this.vam.cd(finalTarget.splitPath);
			if (cdResult.isErr()) {
				logger.warn(
					"[Textfresser.Lemma] Failed to navigate from placeholder to final target",
					{
						error: cdResult.error,
						finalTarget: finalTarget.splitPath,
						placeholderPath,
					},
				);
			}
		}

		return ok(undefined);
	}

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

		const lemmaResult = this.state.latestLemmaResult;
		if (!lemmaResult) return;

		const targetPath =
			this.state.latestResolvedLemmaTargetPath ??
			buildPolicyDestinationPath({
				lemma: lemmaResult.lemma,
				linguisticUnit: lemmaResult.linguisticUnit,
				posLikeKind:
					lemmaResult.linguisticUnit === "Lexem"
						? lemmaResult.posLikeKind
						: null,
				surfaceKind: lemmaResult.surfaceKind,
				targetLanguage: this.state.languages.target,
			});

		const promise = this.runBackgroundGenerate(
			targetPath,
			lemmaResult.lemma,
			notify,
		)
			.catch((error) => {
				const reason =
					error instanceof Error ? error.message : String(error);
				logger.warn("[Textfresser.backgroundGenerate] Failed:", reason);
				notify(`⚠ Background generate failed: ${reason}`);
			})
			.finally(() => {
				this.state.inFlightGenerate = null;
			});

		this.state.inFlightGenerate = {
			lemma: lemmaResult.lemma,
			promise,
			targetPath,
		};
	}

	/** Run the Generate pipeline for a target note without navigating to it. */
	private async runBackgroundGenerate(
		targetPath: SplitPathToMdFile,
		lemma: string,
		notify: (message: string) => void,
	): Promise<void> {
		const contentResult = await this.vam.readContent(targetPath);
		const content = contentResult.isOk() ? contentResult.value : "";

		const input: CommandInput = {
			commandContext: {
				activeFile: { content, splitPath: targetPath },
				selection: null,
			},
			resultingActions: [],
			textfresserState: this.state,
		};

		const generateResult = await commandFnForCommandKind.Generate(input);
		if (generateResult.isErr()) {
			const error = generateResult.error;
			const reason =
				"reason" in error
					? error.reason
					: `Command failed: ${error.kind}`;
			throw new Error(reason);
		}

		const upsertAction: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { splitPath: targetPath },
		};
		const allActions = [upsertAction, ...generateResult.value];

		const dispatchResult = await this.vam.dispatch(allActions);
		if (dispatchResult.isErr()) {
			const reason = dispatchResult.error.map((e) => e.error).join(", ");
			throw new Error(reason);
		}

		const failed = this.state.latestFailedSections;
		if (failed.length > 0) {
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
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 300));

		const currentFile = this.vam.mdPwd();
		if (
			!currentFile ||
			!areSameSplitPath(currentFile, inFlight.targetPath)
		) {
			return;
		}

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
