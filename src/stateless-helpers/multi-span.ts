/**
 * Multi-span replacement utilities.
 *
 * Handles discontinuous lemma linking — e.g., separable prefix verbs
 * ("Pass auf dich auf" → two wikilinks) and phrasem parts.
 */

import { logger } from "../utils/logger";

export type BracketedSpan = {
	/** The text inside the brackets */
	text: string;
	/** Start index in the stripped (bracket-free) string */
	strippedStart: number;
	/** End index in the stripped (bracket-free) string */
	strippedEnd: number;
};

export type ResolvedSpan = {
	/** The text to replace */
	text: string;
	/** Start index in the raw block */
	rawStart: number;
	/** End index in the raw block */
	rawEnd: number;
};

/**
 * Parse [bracketed] spans from a marked string.
 * O(n) single-pass extraction.
 *
 * Example: "[Pass] auf dich [auf]"
 * → [{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
 *    { text: "auf", strippedStart: 15, strippedEnd: 18 }]
 */
function parseBracketedSpans(marked: string): BracketedSpan[] {
	const spans: BracketedSpan[] = [];
	let strippedPos = 0;
	let i = 0;

	while (i < marked.length) {
		if (marked[i] === "[") {
			const closeIdx = marked.indexOf("]", i + 1);
			if (closeIdx === -1) {
				// Malformed: no closing bracket, treat rest as plain text
				strippedPos += marked.length - i;
				break;
			}
			const text = marked.slice(i + 1, closeIdx);
			spans.push({
				strippedEnd: strippedPos + text.length,
				strippedStart: strippedPos,
				text,
			});
			strippedPos += text.length;
			i = closeIdx + 1;
		} else {
			strippedPos++;
			i++;
		}
	}

	return spans;
}

/**
 * Strip square brackets from a string.
 * "[Pass] auf dich [auf]" → "Pass auf dich auf"
 */
function stripBrackets(text: string): string {
	return text.replace(/[[\]]/g, "");
}

// TODO: search radius is a tunable parameter — 50 chars works for typical German sentences
const SEARCH_RADIUS = 50;

/**
 * Map bracketed spans to positions in the raw block using anchor-calibrated search.
 *
 * 1. Find the anchor span (the original user selection) using surface + offset proximity
 * 2. Compute baseDelta = anchorRawOffset - anchorSpan.strippedStart
 * 3. For each additional span: estimate rawPos, find nearest exact match within SEARCH_RADIUS
 * 4. Skip spans inside existing [[wikilinks]]
 * 5. Return null on any failure (overlaps, missing matches) → triggers single-span fallback
 */
function mapSpansToRawBlock(
	rawBlock: string,
	spans: BracketedSpan[],
	anchorSurface: string,
	anchorRawOffset: number,
): ResolvedSpan[] | null {
	if (spans.length === 0) return null;

	// Step 1: Find anchor span — the one matching the original selection
	const anchorSpan = spans.find((s) => s.text === anchorSurface);
	if (!anchorSpan) {
		logger.warn(
			`[multiSpan] anchor surface "${anchorSurface}" not found in spans`,
		);
		return null;
	}

	// Verify anchor matches at the expected raw offset
	const anchorCandidate = rawBlock.slice(
		anchorRawOffset,
		anchorRawOffset + anchorSurface.length,
	);
	if (anchorCandidate !== anchorSurface) {
		logger.warn(
			`[multiSpan] anchor verification failed: expected "${anchorSurface}" at ${anchorRawOffset}, got "${anchorCandidate}"`,
		);
		return null;
	}

	// Step 2: Compute baseDelta
	const baseDelta = anchorRawOffset - anchorSpan.strippedStart;

	const resolved: ResolvedSpan[] = [];

	for (const span of spans) {
		if (span === anchorSpan) {
			// Anchor position is known exactly
			resolved.push({
				rawEnd: anchorRawOffset + anchorSurface.length,
				rawStart: anchorRawOffset,
				text: span.text,
			});
			continue;
		}

		// Step 3: Estimate position and search nearby
		const estimatedPos = span.strippedStart + baseDelta;
		const found = findNearestMatch(
			rawBlock,
			span.text,
			estimatedPos,
			SEARCH_RADIUS,
		);

		if (found === null) {
			logger.warn(
				`[multiSpan] could not find "${span.text}" near estimated position ${estimatedPos}`,
			);
			return null;
		}

		// Step 4: Check if this position is inside an existing wikilink
		if (isInsideWikilink(rawBlock, found)) {
			logger.warn(
				`[multiSpan] span "${span.text}" at ${found} is inside an existing wikilink — skipping`,
			);
			continue;
		}

		resolved.push({
			rawEnd: found + span.text.length,
			rawStart: found,
			text: span.text,
		});
	}

	// Step 5: Sort by position and verify no overlaps
	resolved.sort((a, b) => a.rawStart - b.rawStart);

	for (let i = 1; i < resolved.length; i++) {
		const prev = resolved[i - 1];
		const curr = resolved[i];
		if (prev && curr && prev.rawEnd > curr.rawStart) {
			logger.warn(
				`[multiSpan] overlap detected: "${prev.text}" [${prev.rawStart}-${prev.rawEnd}] and "${curr.text}" [${curr.rawStart}-${curr.rawEnd}]`,
			);
			return null;
		}
	}

	return resolved;
}

/**
 * Find the nearest exact match of `needle` in `haystack` starting from
 * `estimatedPos`, searching within ±radius.
 * Returns the start index or null if not found.
 */
function findNearestMatch(
	haystack: string,
	needle: string,
	estimatedPos: number,
	radius: number,
): number | null {
	// Check estimated position first (fast path)
	if (
		estimatedPos >= 0 &&
		estimatedPos + needle.length <= haystack.length &&
		haystack.slice(estimatedPos, estimatedPos + needle.length) === needle
	) {
		return estimatedPos;
	}

	// Spiral outward from estimated position
	for (let delta = 1; delta <= radius; delta++) {
		for (const sign of [-1, 1]) {
			const pos = estimatedPos + delta * sign;
			if (
				pos >= 0 &&
				pos + needle.length <= haystack.length &&
				haystack.slice(pos, pos + needle.length) === needle
			) {
				return pos;
			}
		}
	}

	return null;
}

/**
 * Check if a position in the raw block is inside an existing [[wikilink]].
 */
function isInsideWikilink(rawBlock: string, pos: number): boolean {
	// Search backward for [[ without hitting ]]
	let i = pos - 1;
	while (i >= 0) {
		if (i > 0 && rawBlock[i - 1] === "]" && rawBlock[i] === "]") {
			// Found closing ]] before opening [[ — not inside a wikilink
			return false;
		}
		if (i > 0 && rawBlock[i - 1] === "[" && rawBlock[i] === "[") {
			// Found opening [[ — check there's a ]] after pos
			const closeIdx = rawBlock.indexOf("]]", pos);
			return closeIdx !== -1;
		}
		i--;
	}
	return false;
}

/**
 * Build a wikilink from surface and lemma.
 * If lemma differs from surface: [[lemma|surface]], else [[surface]].
 */
function buildWikilink(surface: string, lemma: string): string {
	return lemma !== surface ? `[[${lemma}|${surface}]]` : `[[${surface}]]`;
}

/**
 * Apply multi-span replacement: replace all resolved spans with wikilinks.
 * Replaces right-to-left to preserve earlier offsets.
 */
function applyMultiSpanReplacement(
	rawBlock: string,
	resolvedSpans: ResolvedSpan[],
	lemma: string,
): string {
	// Sort right-to-left to preserve offsets during replacement
	const sorted = [...resolvedSpans].sort((a, b) => b.rawStart - a.rawStart);

	let result = rawBlock;
	for (const span of sorted) {
		const wikilink = buildWikilink(span.text, lemma);
		result =
			result.slice(0, span.rawStart) +
			wikilink +
			result.slice(span.rawEnd);
	}

	return result;
}

export const multiSpanHelper = {
	applyMultiSpanReplacement,
	mapSpansToRawBlock,
	parseBracketedSpans,
	stripBrackets,
};
