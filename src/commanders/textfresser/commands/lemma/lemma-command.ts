import { errAsync, ok, type ResultAsync } from "neverthrow";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import { blockIdHelper } from "../../../../stateless-helpers/block-id";
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
export function resolveAttestation(input: CommandInput): Attestation | null {
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
 * Build a wikilink from displayed surface and target.
 * If target differs from surface: [[target|surface]], else [[surface]].
 */
export function buildWikilinkForTarget(
	surface: string,
	linkTarget: string,
): string {
	return linkTarget !== surface
		? `[[${linkTarget}|${surface}]]`
		: `[[${surface}]]`;
}

function replaceAt(
	text: string,
	offset: number,
	length: number,
	replacement: string,
): string {
	return text.slice(0, offset) + replacement + text.slice(offset + length);
}

function isInsideWikilink(text: string, index: number): boolean {
	const open = text.lastIndexOf("[[", index);
	if (open === -1) return false;
	const closedBefore = text.lastIndexOf("]]", index);
	if (closedBefore > open) return false;
	const closedAfter = text.indexOf("]]", index);
	return closedAfter !== -1;
}

function findReplaceableSurfaceIndex(text: string, surface: string): number {
	let start = 0;
	for (;;) {
		const idx = text.indexOf(surface, start);
		if (idx === -1) return -1;
		if (!isInsideWikilink(text, idx)) return idx;
		start = idx + surface.length;
	}
}

function replaceFirstSurfaceOutsideWikilink(
	text: string,
	surface: string,
	wikilink: string,
): string | null {
	const idx = findReplaceableSurfaceIndex(text, surface);
	if (idx === -1) return null;
	return replaceAt(text, idx, surface.length, wikilink);
}

function replaceSurfaceByOffset(
	text: string,
	surface: string,
	wikilink: string,
	offset: number | undefined,
): string | null {
	if (offset === undefined || offset < 0) return null;
	const candidate = text.slice(offset, offset + surface.length);
	if (candidate !== surface) return null;
	if (isInsideWikilink(text, offset)) return null;
	return replaceAt(text, offset, surface.length, wikilink);
}

function iterWikilinks(text: string): Array<{
	index: number;
	fullMatch: string;
	surface: string;
}> {
	const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
	const matches: Array<{
		index: number;
		fullMatch: string;
		surface: string;
	}> = [];

	for (const match of text.matchAll(regex)) {
		const index = match.index;
		const fullMatch = match[0];
		const target = match[1];
		const alias = match[2];
		if (
			index === undefined ||
			typeof fullMatch !== "string" ||
			typeof target !== "string"
		) {
			continue;
		}

		matches.push({
			fullMatch,
			index,
			surface: alias ?? target,
		});
	}

	return matches;
}

function replaceFirstWikilinkByDisplayedSurface(
	text: string,
	surface: string,
	replacement: string,
): string | null {
	const matches = iterWikilinks(text);
	for (const match of matches) {
		if (match.surface !== surface) continue;
		return replaceAt(
			text,
			match.index,
			match.fullMatch.length,
			replacement,
		);
	}
	return null;
}

function replaceWikilinkByOffset(
	text: string,
	surface: string,
	replacement: string,
	offset: number | undefined,
): string | null {
	if (offset === undefined || offset < 0) return null;

	const matches = iterWikilinks(text);
	for (const match of matches) {
		const start = match.index;
		const end = start + match.fullMatch.length;
		if (offset < start || offset >= end) continue;
		if (match.surface !== surface) continue;
		return replaceAt(text, start, match.fullMatch.length, replacement);
	}

	return null;
}

function tryRewriteLine(params: {
	line: string;
	primarySurface: string;
	fallbackSurface: string;
	replacement: string;
	replaceOffset: number | undefined;
}): string | null {
	const {
		line,
		primarySurface,
		fallbackSurface,
		replacement,
		replaceOffset,
	} = params;

	const byOffsetPlain = replaceSurfaceByOffset(
		line,
		primarySurface,
		replacement,
		replaceOffset,
	);
	if (byOffsetPlain) return byOffsetPlain;

	const byOffsetWikilink = replaceWikilinkByOffset(
		line,
		primarySurface,
		replacement,
		replaceOffset,
	);
	if (byOffsetWikilink) return byOffsetWikilink;

	const bySearchPlain = replaceFirstSurfaceOutsideWikilink(
		line,
		primarySurface,
		replacement,
	);
	if (bySearchPlain) return bySearchPlain;

	const bySearchWikilink = replaceFirstWikilinkByDisplayedSurface(
		line,
		primarySurface,
		replacement,
	);
	if (bySearchWikilink) return bySearchWikilink;

	if (fallbackSurface === primarySurface) return null;

	const byOffsetFallbackPlain = replaceSurfaceByOffset(
		line,
		fallbackSurface,
		replacement,
		replaceOffset,
	);
	if (byOffsetFallbackPlain) return byOffsetFallbackPlain;

	const byOffsetFallbackWikilink = replaceWikilinkByOffset(
		line,
		fallbackSurface,
		replacement,
		replaceOffset,
	);
	if (byOffsetFallbackWikilink) return byOffsetFallbackWikilink;

	const bySearchFallbackPlain = replaceFirstSurfaceOutsideWikilink(
		line,
		fallbackSurface,
		replacement,
	);
	if (bySearchFallbackPlain) return bySearchFallbackPlain;

	return replaceFirstWikilinkByDisplayedSurface(
		line,
		fallbackSurface,
		replacement,
	);
}

export function rewriteAttestationSourceContent(params: {
	content: string;
	offsetInBlock?: number;
	replaceOffsetInBlock?: number;
	replaceSurface?: string;
	rawBlock: string;
	surface: string;
	updatedBlock: string;
	wikilink: string;
}): string {
	const {
		content,
		offsetInBlock,
		replaceOffsetInBlock,
		replaceSurface,
		rawBlock,
		surface,
		updatedBlock,
		wikilink,
	} = params;
	const finalSurface = replaceSurface ?? surface;
	const finalOffset = replaceOffsetInBlock ?? offsetInBlock;

	if (content.includes(rawBlock)) {
		return content.replace(rawBlock, updatedBlock);
	}

	const blockId = blockIdHelper.extractFromLine(rawBlock);
	if (blockId) {
		const marker = `^${blockId}`;
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line || !line.includes(marker)) continue;

			const normalizedLine =
				replaceFirstWikilinkByDisplayedSurface(
					line,
					surface,
					surface,
				) ?? line;
			if (
				normalizedLine === rawBlock ||
				markdownHelper.stripAll(normalizedLine) ===
					markdownHelper.stripAll(rawBlock)
			) {
				lines[i] = updatedBlock;
				return lines.join("\n");
			}

			const rewritten = tryRewriteLine({
				fallbackSurface: surface,
				line,
				primarySurface: finalSurface,
				replacement: wikilink,
				replaceOffset: finalOffset,
			});
			if (rewritten) {
				lines[i] = rewritten;
				return lines.join("\n");
			}
			break;
		}
	}

	const fallback =
		tryRewriteLine({
			fallbackSurface: surface,
			line: content,
			primarySurface: finalSurface,
			replacement: wikilink,
			replaceOffset: finalOffset,
		}) ??
		replaceFirstSurfaceOutsideWikilink(content, finalSurface, wikilink) ??
		replaceFirstSurfaceOutsideWikilink(content, surface, wikilink);
	return fallback ?? content;
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
								const wikilink = buildWikilinkForTarget(
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
				const wikilink = buildWikilinkForTarget(surface, result.lemma);

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
						splitPath: attestation.source.path,
						transform: (content: string) =>
							rewriteAttestationSourceContent({
								content,
								offsetInBlock: offset ?? undefined,
								rawBlock,
								surface,
								updatedBlock,
								wikilink: buildWikilinkForTarget(
									surface,
									result.lemma,
								),
							}),
					},
				},
			];

			return ok(actions);
		});
}
