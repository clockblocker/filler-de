import { blockIdHelper } from "../../../../stateless-helpers/block-id";
import { markdownHelper } from "../../../../stateless-helpers/markdown-strip";
import { logger } from "../../../../utils/logger";
import { buildAttestationFromSelection } from "../../common/attestation/builders/build-from-selection";
import type { Attestation } from "../../common/attestation/types";
import type { CommandInput } from "../types";

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

/**
 * Detect malformed nested wikilinks like [[a|[[b]]]].
 */
export function hasNestedWikilinkStructure(text: string): boolean {
	let depth = 0;

	for (let i = 0; i < text.length - 1; i++) {
		const token = text.slice(i, i + 2);
		if (token === "[[") {
			if (depth > 0) {
				return true;
			}
			depth += 1;
			i += 1;
			continue;
		}

		if (token === "]]" && depth > 0) {
			depth -= 1;
			i += 1;
		}
	}

	return false;
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
		return replaceAt(text, match.index, match.fullMatch.length, replacement);
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
	if (updatedBlock === rawBlock) {
		return content;
	}

	if (hasNestedWikilinkStructure(updatedBlock)) {
		logger.warn(
			"[lemma] nested wikilink detected in updatedBlock — keeping source unchanged",
		);
		return content;
	}

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
				replaceFirstWikilinkByDisplayedSurface(line, surface, surface) ??
				line;
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
