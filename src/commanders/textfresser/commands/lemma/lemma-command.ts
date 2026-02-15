import { errAsync, ok, type ResultAsync } from "neverthrow";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import { markdownHelper } from "../../../../stateless-helpers/markdown-strip";
import { multiSpanHelper } from "../../../../stateless-helpers/multi-span";
import { logger } from "../../../../utils/logger";
import { buildAttestationFromSelection } from "../../common/attestation/builders/build-from-selection";
import type { Attestation } from "../../common/attestation/types";
import {
	type CommandError,
	CommandErrorKind,
	type CommandInput,
} from "../types";
import { disambiguateSense } from "./steps/disambiguate-sense";

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

export function expandOffsetForLinkedSpan(
	rawBlock: string,
	surface: string,
	offset: number,
	linkedSurface: string,
): { replaceOffset: number; replaceSurface: string } {
	const idxInLinked = linkedSurface.indexOf(surface);
	if (idxInLinked === -1) {
		return { replaceOffset: offset, replaceSurface: surface };
	}

	const replaceOffset = offset - idxInLinked;
	const candidate = rawBlock.slice(
		replaceOffset,
		replaceOffset + linkedSurface.length,
	);
	if (candidate !== linkedSurface) {
		return { replaceOffset: offset, replaceSurface: surface };
	}

	return { replaceOffset, replaceSurface: linkedSurface };
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
		.mapErr((e): CommandError => {
			logger.warn(
				"[lemma] Lemma prompt failed before dispatching actions",
				{
					reason: e.reason,
					surface,
				},
			);
			return {
				kind: CommandErrorKind.ApiError,
				reason: e.reason,
			};
		})
		.andThen((lemmaResult) => {
			if (lemmaResult.linguisticUnit === "Lexem") {
				return disambiguateSense(
					textfresserState.vam,
					textfresserState.promptRunner,
					{
						lemma: lemmaResult.lemma,
						linguisticUnit: "Lexem",
						pos: lemmaResult.posLikeKind,
						surfaceKind: lemmaResult.surfaceKind,
					},
					context,
				).map((disambiguationResult) => ({
					...lemmaResult,
					disambiguationResult,
				}));
			}

			return disambiguateSense(
				textfresserState.vam,
				textfresserState.promptRunner,
				{
					lemma: lemmaResult.lemma,
					linguisticUnit: "Phrasem",
					phrasemeKind: lemmaResult.posLikeKind,
					surfaceKind: lemmaResult.surfaceKind,
				},
				context,
			).map((disambiguationResult) => ({
				...lemmaResult,
				disambiguationResult,
			}));
		})
		.andThen((result) => {
			const precomputedEmojiDescription =
				result.disambiguationResult &&
				"precomputedEmojiDescription" in result.disambiguationResult
					? result.disambiguationResult.precomputedEmojiDescription
					: undefined;

			// Normalize disambiguationResult: strip precomputedEmojiDescription, keep only matchedIndex shape
			const disambiguationResult =
				result.disambiguationResult === null ||
				result.disambiguationResult.matchedIndex === null
					? null
					: {
							matchedIndex:
								result.disambiguationResult.matchedIndex,
						};

			if (result.linguisticUnit === "Lexem") {
				textfresserState.latestLemmaResult = {
					attestation,
					disambiguationResult,
					lemma: result.lemma,
					linguisticUnit: "Lexem",
					posLikeKind: result.posLikeKind,
					precomputedEmojiDescription,
					surfaceKind: result.surfaceKind,
				};
			} else {
				textfresserState.latestLemmaResult = {
					attestation,
					disambiguationResult,
					lemma: result.lemma,
					linguisticUnit: "Phrasem",
					posLikeKind: result.posLikeKind,
					precomputedEmojiDescription,
					surfaceKind: result.surfaceKind,
				};
			}

			const rawBlock = attestation.source.textRaw;
			const offset = attestation.target.offsetInBlock;

			// Try multi-span replacement for separable verbs / phrasems
			let updatedBlock: string | null = null;

			if (result.contextWithLinkedParts && offset !== undefined) {
				const stripped = multiSpanHelper.stripBrackets(
					result.contextWithLinkedParts,
				);
				const expectedStripped = markdownHelper.stripAll(rawBlock);

				if (stripped === expectedStripped) {
					const spans = multiSpanHelper.parseBracketedSpans(
						result.contextWithLinkedParts,
					);
					if (spans.length > 1) {
						const resolved = multiSpanHelper.mapSpansToRawBlock(
							rawBlock,
							spans,
							surface,
							offset,
						);
						if (resolved && resolved.length > 1) {
							updatedBlock =
								multiSpanHelper.applyMultiSpanReplacement(
									rawBlock,
									resolved,
									result.lemma,
								);

							// Update attestation context to show all linked parts
							attestation.source.textWithOnlyTargetMarked =
								result.contextWithLinkedParts;
						}
					}

					// Single expanded span (e.g., proper noun / contiguous phrasem)
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
								const wikilink = buildWikilink(
									expanded.replaceSurface,
									result.lemma,
								);
								updatedBlock =
									rawBlock.slice(0, expanded.replaceOffset) +
									wikilink +
									rawBlock.slice(
										expanded.replaceOffset +
											expanded.replaceSurface.length,
									);
								attestation.source.textWithOnlyTargetMarked =
									result.contextWithLinkedParts;
							}
						}
					}
				} else {
					logger.warn(
						"[lemma] contextWithLinkedParts stripped text mismatch — falling back to single-span",
					);
				}
			}

			// Fall back to single-span replacement
			if (updatedBlock === null) {
				const wikilink = buildWikilink(surface, result.lemma);

				updatedBlock =
					offset !== undefined
						? rawBlock.slice(0, offset) +
							wikilink +
							rawBlock.slice(offset + surface.length)
						: rawBlock.replace(surface, wikilink);
			}

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
