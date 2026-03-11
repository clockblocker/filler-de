import { err, ok, type Result } from "neverthrow";
import {
	PHRASEM_KINDS,
	type PhrasemeKind,
} from "../../../../linguistics/common/enums/linguistic-units/phrasem/phrasem-kind";
import { DE_LEXEM_POS, type DeLexemPos } from "../../../../linguistics/de";
import type {
	VaultAction,
	VaultActionManager,
} from "../../../../managers/obsidian/vault-action-manager";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import { splitPathsEqual } from "../../../../stateless-helpers/split-path-comparison";
import { logger } from "../../../../utils/logger";
import {
	buildWikilinkForTarget,
	hasNestedWikilinkStructure,
	resolveAttestation,
	rewriteAttestationSourceContent,
} from "../../commands/lemma/lemma-command";
import { disambiguateSense } from "../../commands/lemma/steps/disambiguate-sense";
import type { CommandError, CommandInput } from "../../commands/types";
import { buildSourceFields } from "../../common/attestation/builders/build-source-fields";
import type { Attestation } from "../../common/attestation/types";
import {
	computeFinalTarget,
	computePrePromptTarget,
	isUnknownWorkingPath,
} from "../../common/lemma-link-routing";
import { CommandErrorKind } from "../../errors";
import type { TextfresserState } from "../../state/textfresser-state";
import { dispatchActions } from "../shared/dispatch-actions";
import {
	chooseBestEffortLemmaOutput,
	evaluateLemmaOutputGuardrails,
} from "./lemma-output-guardrails";
import {
	buildLemmaRewritePlan,
	buildUpdatedBlock,
	type RewritePlan,
} from "./lemma-rewrite-plan";

type ResolvedPosLikeKind =
	| {
			linguisticUnit: "Lexem";
			posLikeKind: DeLexemPos;
	  }
	| {
			linguisticUnit: "Phrasem";
			posLikeKind: PhrasemeKind;
	  };

export async function runLemmaTwoPhase(params: {
	input: CommandInput;
	preResolvedAttestation?: Attestation;
	state: TextfresserState;
	vam: VaultActionManager;
}): Promise<Result<void, CommandError>> {
	const { input, preResolvedAttestation, state, vam } = params;
	const attestation = preResolvedAttestation ?? resolveAttestation(input);
	if (!attestation) {
		return err({
			kind: CommandErrorKind.NotEligible,
			reason: "No attestation context available — select a word or click a wikilink first",
		});
	}

	const surface = attestation.target.surface;
	const prePromptTarget = computePrePromptTarget({
		findByBasename: (basename) => vam.findByBasename(basename),
		resolveLinkpathDest: (linkpath, from) =>
			vam.resolveLinkpathDest(linkpath, from),
		sourcePath: attestation.source.path,
		surface,
		targetLanguage: state.languages.target,
	});
	const placeholderPath = prePromptTarget.shouldCreatePlaceholder
		? prePromptTarget.splitPath
		: null;
	const placeholderExistedBeforePhaseA =
		placeholderPath !== null && vam.exists(placeholderPath);
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

	const phaseADispatch = await dispatchActions(vam, phaseAActions);
	if (phaseADispatch.isErr()) {
		return err(phaseADispatch.error);
	}

	const context = attestation.source.textWithOnlyTargetMarked;
	const lemmaPromptResult = await state.promptRunner.generate(
		PromptKind.Lemma,
		{ context, surface },
	);
	if (lemmaPromptResult.isErr()) {
		return err({
			kind: CommandErrorKind.ApiError,
			reason: lemmaPromptResult.error.reason,
		});
	}
	const firstGuardrailEvaluation = evaluateLemmaOutputGuardrails({
		context,
		output: lemmaPromptResult.value,
		surface,
	});
	let selectedGuardrailEvaluation = firstGuardrailEvaluation;

	if (firstGuardrailEvaluation.coreIssues.length > 0) {
		logger.warn(
			"[Textfresser.Lemma] Guardrail rejected first lemma output; retrying once",
			{
				coreIssues: firstGuardrailEvaluation.coreIssues,
				firstOutput: firstGuardrailEvaluation.output,
				surface,
			},
		);
		const retryPromptResult = await state.promptRunner.generate(
			PromptKind.Lemma,
			{ context, surface },
		);
		if (retryPromptResult.isErr()) {
			return err({
				kind: CommandErrorKind.ApiError,
				reason: retryPromptResult.error.reason,
			});
		}

		const secondGuardrailEvaluation = evaluateLemmaOutputGuardrails({
			context,
			output: retryPromptResult.value,
			surface,
		});
		selectedGuardrailEvaluation = chooseBestEffortLemmaOutput({
			first: firstGuardrailEvaluation,
			second: secondGuardrailEvaluation,
		});

		if (secondGuardrailEvaluation.coreIssues.length > 0) {
			logger.warn(
				"[Textfresser.Lemma] Guardrail retry exhausted; continuing with best-effort output",
				{
					firstCoreIssues: firstGuardrailEvaluation.coreIssues,
					firstOutput: firstGuardrailEvaluation.output,
					secondCoreIssues: secondGuardrailEvaluation.coreIssues,
					secondOutput: secondGuardrailEvaluation.output,
					selectedOutput: selectedGuardrailEvaluation.output,
					surface,
				},
			);
		}
	}

	if (selectedGuardrailEvaluation.droppedContextWithLinkedParts) {
		logger.warn(
			"[Textfresser.Lemma] Dropping unsafe contextWithLinkedParts due stripped-text mismatch",
			{
				output: selectedGuardrailEvaluation.output,
				surface,
			},
		);
	}
	const lemmaPromptOutput = selectedGuardrailEvaluation.output;
	const resolvedPosLikeKind = resolvePosLikeKind(lemmaPromptOutput);
	if (!resolvedPosLikeKind) {
		return err({
			kind: CommandErrorKind.ApiError,
			reason: "Lemma output has invalid posLikeKind for linguisticUnit",
		});
	}

	const finalTarget = computeFinalTarget({
		findByBasename: (basename) => vam.findByBasename(basename),
		lemma: lemmaPromptOutput.lemma,
		linguisticUnit: lemmaPromptOutput.linguisticUnit,
		lookupInLibrary: state.lookupInLibrary,
		posLikeKind:
			resolvedPosLikeKind.linguisticUnit === "Lexem"
				? resolvedPosLikeKind.posLikeKind
				: null,
		surfaceKind: lemmaPromptOutput.surfaceKind,
		targetLanguage: state.languages.target,
	});

	let disambiguation: Awaited<ReturnType<typeof disambiguateSense>>;
	if (resolvedPosLikeKind.linguisticUnit === "Lexem") {
		disambiguation = await disambiguateSense(
			vam,
			state.promptRunner,
			{
				lemma: lemmaPromptOutput.lemma,
				linguisticUnit: "Lexem",
				pos: resolvedPosLikeKind.posLikeKind,
				surfaceKind: lemmaPromptOutput.surfaceKind,
			},
			context,
			finalTarget.splitPath,
		);
	} else {
		disambiguation = await disambiguateSense(
			vam,
			state.promptRunner,
			{
				lemma: lemmaPromptOutput.lemma,
				linguisticUnit: "Phrasem",
				phrasemeKind: resolvedPosLikeKind.posLikeKind,
				surfaceKind: lemmaPromptOutput.surfaceKind,
			},
			context,
			finalTarget.splitPath,
		);
	}
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

	const rewritePlan = buildLemmaRewritePlan({
		attestation,
		contextWithLinkedParts:
			lemmaPromptOutput.contextWithLinkedParts ?? undefined,
		linkTarget: finalTarget.linkTarget,
	});

	const currentPath = vam.mdPwd();
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
		const finalExists = vam.exists(finalTarget.splitPath);
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
				const placeholderContentResult =
					await vam.readContent(placeholderPath);
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
	}

	if (!placeholderWasRenamed && !vam.exists(finalTarget.splitPath)) {
		phaseBActions.push({
			kind: VaultActionKind.UpsertMdFile,
			payload: { splitPath: finalTarget.splitPath },
		});
		finalTargetOwnedByInvocation = true;
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

	const phaseBDispatch = await dispatchActions(vam, phaseBActions);
	if (phaseBDispatch.isErr()) {
		return err(phaseBDispatch.error);
	}

	syncAttestationAfterSemanticResolution({
		attestation,
		lemma: lemmaPromptOutput.lemma,
		rewritePlan,
	});
	if (resolvedPosLikeKind.linguisticUnit === "Lexem") {
		state.latestLemmaResult = {
			attestation,
			disambiguationResult: normalizedDisambiguation,
			lemma: lemmaPromptOutput.lemma,
			linguisticUnit: "Lexem",
			posLikeKind: resolvedPosLikeKind.posLikeKind,
			precomputedEmojiDescription,
			surfaceKind: lemmaPromptOutput.surfaceKind,
		};
	} else {
		state.latestLemmaResult = {
			attestation,
			disambiguationResult: normalizedDisambiguation,
			lemma: lemmaPromptOutput.lemma,
			linguisticUnit: "Phrasem",
			posLikeKind: resolvedPosLikeKind.posLikeKind,
			precomputedEmojiDescription,
			surfaceKind: lemmaPromptOutput.surfaceKind,
		};
	}
	state.latestResolvedLemmaTargetPath = finalTarget.splitPath;

	state.latestLemmaPlaceholderPath = placeholderWasCleaned
		? undefined
		: (placeholderPath ?? undefined);
	state.latestLemmaTargetOwnedByInvocation = finalTargetOwnedByInvocation;

	if (shouldNavigateToFinal) {
		const cdResult = await vam.cd(navigationTarget);
		if (cdResult.isErr()) {
			logger.warn(
				"[Textfresser.Lemma] Failed to navigate from placeholder to final target",
				{
					error: cdResult.error,
					finalTarget: finalTarget.splitPath,
					navigationTarget,
					placeholderPath,
				},
			);
		}
	}

	return ok(undefined);
}

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

function isDeLexemPosLikeKind(value: string): value is DeLexemPos {
	return DE_LEXEM_POS.some((pos) => pos === value);
}

function isPhrasemeKind(value: string): value is PhrasemeKind {
	return PHRASEM_KINDS.some((kind) => kind === value);
}

function resolvePosLikeKind(output: {
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: string;
}): ResolvedPosLikeKind | null {
	if (output.linguisticUnit === "Lexem") {
		if (!isDeLexemPosLikeKind(output.posLikeKind)) {
			return null;
		}
		return {
			linguisticUnit: "Lexem",
			posLikeKind: output.posLikeKind,
		};
	}

	if (!isPhrasemeKind(output.posLikeKind)) {
		return null;
	}

	return {
		linguisticUnit: "Phrasem",
		posLikeKind: output.posLikeKind,
	};
}
