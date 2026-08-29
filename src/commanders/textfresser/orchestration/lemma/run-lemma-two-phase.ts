import type { ResolvedSelection } from "@textfresser/lexical-generation";
import type { VaultAction } from "@textfresser/vault-action-manager";
import { VaultActionKind } from "@textfresser/vault-action-manager";
import type { VaultActionManager } from "@textfresser/vault-action-manager/facade";
import { Effect, Option, Result } from "effect";
import { splitPathsEqual } from "../../../../stateless-helpers/split-path-comparison";
import { logger } from "../../../../utils/logger";
import {
	buildWikilinkForTarget,
	hasNestedWikilinkStructure,
	resolveAttestation,
	rewriteAttestationSourceContent,
} from "../../commands/lemma/lemma-command";
import { resolveSenseMatchFromVault } from "../../commands/lemma/steps/resolve-sense-match-from-vault";
import type { CommandError, CommandInput } from "../../commands/types";
import { buildSourceFields } from "../../common/attestation/builders/build-source-fields";
import type { Attestation } from "../../common/attestation/types";
import {
	computeFinalTarget,
	computePrePromptTarget,
	isUnknownWorkingPath,
} from "../../common/lemma-link-routing";
import { buildLookupCandidates } from "../../common/target-path-resolver";
import {
	getSelectionPos,
	getSelectionSurfaceKind,
	getSelectionUnitKind,
	getSpelledLemma,
	isLexemeSelection,
	isPhrasemeSelection,
} from "../../domain/native-selection";
import { CommandErrorKind, commandApiError } from "../../errors";
import type { TextfresserState } from "../../state/textfresser-state";
import { dispatchActions } from "../shared/dispatch-actions";
import { resultToEffect } from "../shared/effect-result";
import { vamIoFailureToCommandError } from "../shared/vam-failure";
import {
	buildLemmaRewritePlan,
	buildUpdatedBlock,
	type RewritePlan,
} from "./lemma-rewrite-plan";

export const runLemmaTwoPhase = Effect.fn("Textfresser.runLemmaTwoPhase")(
	function* (params: {
		input: CommandInput;
		preResolvedAttestation?: Attestation;
		state: TextfresserState;
		vam: VaultActionManager;
	}): Effect.fn.Return<void, CommandError> {
		const { input, preResolvedAttestation, state, vam } = params;
		const attestation = preResolvedAttestation ?? resolveAttestation(input);
		if (!attestation) {
			return yield* Effect.fail({
				kind: CommandErrorKind.NotEligible,
				reason: "No attestation context available — select a word or click a wikilink first",
			});
		}

		const surface = attestation.target.surface;
		const lookupCandidates = buildLookupCandidates(surface.trim());
		const prePromptMatches = yield* Effect.all(
			lookupCandidates.map((candidate) =>
				Effect.all({
					byBasename: vam.findByBasename(candidate),
					resolved: vam.resolveLinkpathDest(
						candidate,
						attestation.source.path,
					),
				}).pipe(Effect.mapError(vamIoFailureToCommandError)),
			),
		);
		const prePromptByCandidate = new Map(
			lookupCandidates.map((candidate, index) => [
				candidate,
				prePromptMatches[index],
			]),
		);
		const prePromptTarget = computePrePromptTarget({
			findByBasename: (basename) =>
				prePromptByCandidate.get(basename)?.byBasename ?? [],
		resolveLinkpathDest: (linkpath, _from) =>
				prePromptByCandidate.get(linkpath)?.resolved ?? null,
			sourcePath: attestation.source.path,
			surface,
			targetLanguage: state.languages.target,
		});
		const placeholderPath = prePromptTarget.shouldCreatePlaceholder
			? prePromptTarget.splitPath
			: null;
		const placeholderExistedBeforePhaseA =
			placeholderPath !== null
				? yield* vam
						.exists(placeholderPath)
						.pipe(Effect.mapError(vamIoFailureToCommandError))
				: false;
		state.latestLemmaTargetOwnedByInvocation = false;
		state.latestLemmaPlaceholderPath = placeholderPath ?? undefined;

		const rawBlock = attestation.source.textRaw;
		const offsetInBlock = attestation.target.offsetInBlock ?? undefined;
		const temporaryWikilink = buildWikilinkForTarget(
			surface,
			prePromptTarget.linkTarget,
		);
		const phaseAUpdatedBlock = buildUpdatedBlock(
			rawBlock,
			offsetInBlock,
			surface,
			temporaryWikilink,
		);
		const safePhaseAUpdatedBlock = hasNestedWikilinkStructure(
			phaseAUpdatedBlock,
		)
			? rawBlock
			: phaseAUpdatedBlock;
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
							updatedBlock: safePhaseAUpdatedBlock,
							wikilink: temporaryWikilink,
						}),
				},
			},
		];

		yield* dispatchActions(vam, phaseAActions);

		const context = attestation.source.textWithOnlyTargetMarked;
		const lexicalGeneration = state.lexicalGeneration;
		if (!lexicalGeneration) {
			return yield* Effect.fail(
				commandApiError({
					lexicalGenerationError: state.lexicalGenerationInitError,
					reason:
						state.lexicalGenerationInitError?.message ??
						"Lexical generation is unavailable",
				}),
			);
		}

		const lemmaResult = yield* Effect.promise(() =>
			lexicalGeneration.resolveSelection(surface, context),
		);
		const resolvedLemma: ResolvedSelection = yield* resultToEffect(
			lemmaResult.mapErr((error) =>
				commandApiError({
					lexicalGenerationError: error,
					reason: error.message,
				}),
			),
		);
		const spelledLemma = getSpelledLemma(resolvedLemma);
		const linguisticUnit = getSelectionUnitKind(resolvedLemma);
		const surfaceKind = getSelectionSurfaceKind(resolvedLemma);
		if (!spelledLemma || !linguisticUnit || !surfaceKind) {
			return yield* Effect.fail({
				kind: CommandErrorKind.NotEligible,
				reason: "Selection could not be resolved to a note target",
			});
		}
		if (
			!isLexemeSelection(resolvedLemma) &&
			!isPhrasemeSelection(resolvedLemma)
		) {
			return yield* Effect.fail({
				kind: CommandErrorKind.NotEligible,
				reason: "Selection resolved to an unsupported unit kind",
			});
		}

		const finalMatches = yield* vam
			.findByBasename(spelledLemma)
			.pipe(Effect.mapError(vamIoFailureToCommandError));
		const finalTarget = computeFinalTarget({
			findByBasename: () => finalMatches,
			lemma: spelledLemma,
			linguisticUnit: isLexemeSelection(resolvedLemma)
				? "Lexeme"
				: "Phraseme",
			lookupInLibrary: state.lookupInLibrary,
			posLikeKind: getSelectionPos(resolvedLemma) ?? null,
			surfaceKind,
			targetLanguage: state.languages.target,
		});

		const disambiguationResult = yield* resolveSenseMatchFromVault(
			vam,
			resolvedLemma,
			context,
			finalTarget.splitPath,
			{
				disambiguateWith: lexicalGeneration.disambiguateSense,
			},
		);
		const precomputedSenseEmojis =
			disambiguationResult &&
			"precomputedSenseEmojis" in disambiguationResult
				? disambiguationResult.precomputedSenseEmojis
				: undefined;
		const normalizedDisambiguation =
			disambiguationResult === null ||
			disambiguationResult.matchedIndex === null
				? null
				: { matchedIndex: disambiguationResult.matchedIndex };

		const rewritePlan = buildLemmaRewritePlan({
			attestation,
			contextWithLinkedParts:
				resolvedLemma.contextWithLinkedParts ?? undefined,
			linkTarget: finalTarget.linkTarget,
		});

		const currentPath = yield* vam
			.mdPwd()
			.pipe(Effect.mapError(vamIoFailureToCommandError));
		const navigationTarget = finalTarget.linkTargetSplitPath;
		const shouldNavigateToFinal =
			placeholderPath !== null &&
			currentPath !== null &&
			!splitPathsEqual(placeholderPath, navigationTarget) &&
			splitPathsEqual(currentPath, placeholderPath);

		let placeholderWasCleaned = false;
		let placeholderWasRenamed = false;
		let finalTargetOwnedByInvocation = false;
		const phaseBActions: VaultAction[] = [];

		if (
			placeholderPath &&
			splitPathsEqual(placeholderPath, finalTarget.splitPath)
		) {
			finalTargetOwnedByInvocation = !placeholderExistedBeforePhaseA;
		}

		if (
			placeholderPath &&
			!splitPathsEqual(placeholderPath, finalTarget.splitPath)
		) {
			const finalExists = yield* vam
				.exists(finalTarget.splitPath)
				.pipe(Effect.mapError(vamIoFailureToCommandError));
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
				finalTargetOwnedByInvocation = !placeholderExistedBeforePhaseA;
			} else {
				if (isUnknownWorkingPath(placeholderPath)) {
					phaseBActions.push({
						kind: VaultActionKind.TrashMdFile,
						payload: { splitPath: placeholderPath },
					});
					placeholderWasCleaned = true;
				} else {
					const placeholderContentResult = yield* vam
						.readContent(placeholderPath)
						.pipe(Effect.option);
					if (
						Option.isSome(placeholderContentResult) &&
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
		}

		if (!placeholderWasRenamed) {
			const finalExistsAfterPlaceholder = yield* vam
				.exists(finalTarget.splitPath)
				.pipe(Effect.mapError(vamIoFailureToCommandError));
			if (!finalExistsAfterPlaceholder) {
				phaseBActions.push({
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: finalTarget.splitPath },
				});
				finalTargetOwnedByInvocation = true;
			}
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

		yield* dispatchActions(vam, phaseBActions);

		syncAttestationAfterSemanticResolution({
			attestation,
			lemma: spelledLemma,
			rewritePlan,
		});
		state.latestLemmaResult = isLexemeSelection(resolvedLemma)
			? {
					...resolvedLemma,
					attestation,
					disambiguationResult: normalizedDisambiguation,
					lemma: spelledLemma,
					linguisticUnit: "Lexeme",
					posLikeKind:
						resolvedLemma.surface.discriminators.lemmaSubKind,
					precomputedSenseEmojis,
					surfaceKind,
				}
			: {
					...resolvedLemma,
					attestation,
					disambiguationResult: normalizedDisambiguation,
					lemma: spelledLemma,
					linguisticUnit: "Phraseme",
					posLikeKind: null,
					precomputedSenseEmojis,
					surfaceKind,
				};
		state.latestResolvedLemmaTargetPath = finalTarget.splitPath;

		state.latestLemmaPlaceholderPath = placeholderWasCleaned
			? undefined
			: (placeholderPath ?? undefined);
		state.latestLemmaTargetOwnedByInvocation = finalTargetOwnedByInvocation;

		if (shouldNavigateToFinal) {
			const cdResult = yield* vam
				.cd(navigationTarget)
				.pipe(Effect.result);
			if (Result.isFailure(cdResult)) {
				logger.warn(
					"[Textfresser.Lemma] Failed to navigate from placeholder to final target",
					{
						error: cdResult.failure,
						finalTarget: finalTarget.splitPath,
						navigationTarget,
						placeholderPath,
					},
				);
			}
		}
	},
);

function syncAttestationAfterSemanticResolution(params: {
	attestation: Attestation;
	lemma: string;
	rewritePlan: RewritePlan;
}): void {
	const { attestation, lemma, rewritePlan } = params;
	const resolvedSurface =
		rewritePlan.replaceSurface ?? attestation.target.surface;

	attestation.target.lemma = lemma;
	attestation.target.surface = resolvedSurface;
	if (rewritePlan.replaceOffsetInBlock !== undefined) {
		attestation.target.offsetInBlock = rewritePlan.replaceOffsetInBlock;
	}

	attestation.source.textRaw = rewritePlan.updatedBlock;
	attestation.source.ref = buildSourceFields({
		basename: attestation.source.path.basename,
		blockContent: rewritePlan.updatedBlock,
		surface: resolvedSurface,
	}).ref;
}
