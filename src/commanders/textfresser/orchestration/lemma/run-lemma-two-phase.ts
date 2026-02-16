import { err, ok, type Result } from "neverthrow";
import type {
	VaultAction,
	VaultActionManager,
} from "../../../../managers/obsidian/vault-action-manager";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import { logger } from "../../../../utils/logger";
import {
	buildWikilinkForTarget,
	hasNestedWikilinkStructure,
	resolveAttestation,
	rewriteAttestationSourceContent,
} from "../../commands/lemma/lemma-command";
import { disambiguateSense } from "../../commands/lemma/steps/disambiguate-sense";
import type { CommandError, CommandInput } from "../../commands/types";
import type { Attestation } from "../../common/attestation/types";
import {
	computeFinalTarget,
	computePrePromptTarget,
} from "../../common/lemma-link-routing";
import { CommandErrorKind } from "../../errors";
import type { TextfresserState } from "../../state/textfresser-state";
import { dispatchActions } from "../shared/dispatch-actions";
import { areSameSplitPath } from "../shared/split-path-utils";
import { buildLemmaRewritePlan, buildUpdatedBlock } from "./lemma-rewrite-plan";

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
		lookupInLibrary: state.lookupInLibrary,
		resolveLinkpathDest: (linkpath, from) =>
			vam.resolveLinkpathDest(linkpath, from),
		sourcePath: attestation.source.path,
		surface,
		targetLanguage: state.languages.target,
	});
	const placeholderPath = prePromptTarget.shouldCreatePlaceholder
		? prePromptTarget.splitPath
		: null;
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
	const lemmaPromptOutput = lemmaPromptResult.value;

	const finalTarget = computeFinalTarget({
		findByBasename: (basename) => vam.findByBasename(basename),
		lemma: lemmaPromptOutput.lemma,
		linguisticUnit: lemmaPromptOutput.linguisticUnit,
		lookupInLibrary: state.lookupInLibrary,
		posLikeKind:
			lemmaPromptOutput.linguisticUnit === "Lexem"
				? lemmaPromptOutput.posLikeKind
				: null,
		surfaceKind: lemmaPromptOutput.surfaceKind,
		targetLanguage: state.languages.target,
	});

	const disambiguation =
		lemmaPromptOutput.linguisticUnit === "Lexem"
			? await disambiguateSense(
					vam,
					state.promptRunner,
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
					vam,
					state.promptRunner,
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
		state.latestLemmaResult = {
			attestation,
			disambiguationResult: normalizedDisambiguation,
			lemma: lemmaPromptOutput.lemma,
			linguisticUnit: "Lexem",
			posLikeKind: lemmaPromptOutput.posLikeKind,
			precomputedEmojiDescription,
			surfaceKind: lemmaPromptOutput.surfaceKind,
		};
	} else {
		state.latestLemmaResult = {
			attestation,
			disambiguationResult: normalizedDisambiguation,
			lemma: lemmaPromptOutput.lemma,
			linguisticUnit: "Phrasem",
			posLikeKind: lemmaPromptOutput.posLikeKind,
			precomputedEmojiDescription,
			surfaceKind: lemmaPromptOutput.surfaceKind,
		};
	}
	state.latestResolvedLemmaTargetPath = finalTarget.splitPath;

	const rewritePlan = buildLemmaRewritePlan({
		attestation,
		contextWithLinkedParts:
			lemmaPromptOutput.contextWithLinkedParts ?? undefined,
		linkTarget: finalTarget.linkTarget,
	});

	const currentPath = vam.mdPwd();
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

	if (!placeholderWasRenamed && !vam.exists(finalTarget.splitPath)) {
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

	const phaseBDispatch = await dispatchActions(vam, phaseBActions);
	if (phaseBDispatch.isErr()) {
		return err(phaseBDispatch.error);
	}

	state.latestLemmaPlaceholderPath = placeholderWasCleaned
		? undefined
		: (placeholderPath ?? undefined);

	if (shouldNavigateToFinal) {
		const cdResult = await vam.cd(finalTarget.splitPath);
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
