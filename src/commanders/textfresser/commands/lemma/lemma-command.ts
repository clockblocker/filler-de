import { errAsync, ok, type ResultAsync } from "neverthrow";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import { logger } from "../../../../utils/logger";
import { buildAttestationFromSelection } from "../../common/attestation/builders/build-from-selection";
import type { Attestation } from "../../common/attestation/types";
import {
	type CommandError,
	CommandErrorKind,
	type CommandInput,
} from "../types";
import { disambiguateSense } from "./steps/disambiguate-sense";
import type { NounClass } from "./types";

/**
 * Resolve attestation: prefer wikilink click context, fall back to text selection.
 */
function resolveAttestation(input: CommandInput): Attestation | null {
	const { textfresserState, commandContext } = input;

	if (textfresserState.attestationForLatestNavigated) {
		return textfresserState.attestationForLatestNavigated;
	}

	const selection = commandContext.selection;
	if (selection?.text) {
		return buildAttestationFromSelection(
			selection as typeof selection & { text: string },
		);
	}

	return null;
}

/**
 * Build a wikilink from surface and lemma.
 * If lemma differs from surface: [[lemma|surface]], else [[surface]].
 */
function buildWikilink(surface: string, lemma: string): string {
	return lemma !== surface ? `[[${lemma}|${surface}]]` : `[[${surface}]]`;
}

/**
 * Expand offset and surface when fullSurface extends beyond the selected surface.
 * Returns the expanded offset and the full surface string to replace, or falls back
 * to the original surface/offset if verification fails.
 */
export function expandOffsetForFullSurface(
	rawBlock: string,
	surface: string,
	offset: number,
	fullSurface: string,
): { replaceSurface: string; replaceOffset: number } {
	const surfaceIdxInFull = fullSurface.indexOf(surface);
	if (surfaceIdxInFull === -1) {
		logger.warn(
			`[expandOffset] surface "${surface}" not found in fullSurface "${fullSurface}" — falling back`,
		);
		return { replaceOffset: offset, replaceSurface: surface };
	}

	const expandedOffset = offset - surfaceIdxInFull;
	const candidate = rawBlock.slice(
		expandedOffset,
		expandedOffset + fullSurface.length,
	);

	if (candidate !== fullSurface) {
		logger.warn(
			`[expandOffset] verification failed: expected "${fullSurface}" at offset ${expandedOffset}, got "${candidate}" — falling back`,
		);
		return { replaceOffset: offset, replaceSurface: surface };
	}

	return { replaceOffset: expandedOffset, replaceSurface: fullSurface };
}

/**
 * Lemma command: classify a word, store result in state, and wrap the
 * surface text in a wikilink inside the source block.
 */
export function lemmaCommand(
	input: CommandInput,
): ResultAsync<VaultAction[], CommandError> {
	const { textfresserState } = input;
	const attestation = resolveAttestation(input);

	if (!attestation) {
		return errAsync({
			kind: CommandErrorKind.NotEligible,
			reason: "No attestation context available — select a word or click a wikilink first",
		});
	}

	const surface = attestation.target.surface;
	const context = attestation.source.textWithOnlyTargetMarked;

	return textfresserState.promptRunner
		.generate(PromptKind.Lemma, {
			context,
			surface,
		})
		.mapErr(
			(e): CommandError => ({
				kind: CommandErrorKind.ApiError,
				reason: e.reason,
			}),
		)
		.andThen((apiResult) =>
			disambiguateSense(
				textfresserState.vam,
				textfresserState.promptRunner,
				apiResult,
				context,
			).map((disambiguationResult) => ({
				...apiResult,
				disambiguationResult,
			})),
		)
		.andThen((result) => {
			const precomputedSemantics =
				result.disambiguationResult &&
				"precomputedSemantics" in result.disambiguationResult
					? result.disambiguationResult.precomputedSemantics
					: undefined;

			// Normalize disambiguationResult: strip precomputedSemantics, keep only matchedIndex shape
			const disambiguationResult =
				result.disambiguationResult === null ||
				result.disambiguationResult.matchedIndex === null
					? null
					: {
							matchedIndex:
								result.disambiguationResult.matchedIndex,
						};

			const nounClass: NounClass | undefined =
				result.pos === "Noun" && result.nounClass
					? result.nounClass
					: undefined;

			textfresserState.latestLemmaResult = {
				attestation,
				disambiguationResult,
				lemma: result.lemma,
				linguisticUnit: result.linguisticUnit,
				nounClass,
				pos: result.pos ?? undefined,
				precomputedSemantics,
				surfaceKind: result.surfaceKind,
			};

			const rawBlock = attestation.source.textRaw;
			const offset = attestation.target.offsetInBlock;

			// Expand surface when fullSurface extends beyond the selected text
			const fullSurface = result.fullSurface;
			let replaceSurface = surface;
			let replaceOffset = offset;

			if (
				fullSurface &&
				fullSurface !== surface &&
				offset !== undefined
			) {
				const expanded = expandOffsetForFullSurface(
					rawBlock,
					surface,
					offset,
					fullSurface,
				);
				replaceSurface = expanded.replaceSurface;
				replaceOffset = expanded.replaceOffset;
			}

			const wikilink = buildWikilink(replaceSurface, result.lemma);

			const updatedBlock =
				replaceOffset !== undefined
					? rawBlock.slice(0, replaceOffset) +
						wikilink +
						rawBlock.slice(replaceOffset + replaceSurface.length)
					: rawBlock.replace(surface, wikilink);

			const actions: VaultAction[] = [
				{
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						after: updatedBlock,
						before: rawBlock,
						splitPath: attestation.source.path,
					},
				},
			];

			return ok(actions);
		});
}
