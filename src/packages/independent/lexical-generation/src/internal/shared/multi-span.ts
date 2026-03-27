import { logger } from "./logger";

export type BracketedSpan = {
	strippedEnd: number;
	strippedStart: number;
	text: string;
};

export type ResolvedSpan = {
	rawEnd: number;
	rawStart: number;
	text: string;
};

function parseBracketedSpans(marked: string): BracketedSpan[] {
	const spans: BracketedSpan[] = [];
	let strippedPos = 0;
	let i = 0;

	while (i < marked.length) {
		if (marked[i] === "[") {
			const closeIdx = marked.indexOf("]", i + 1);
			if (closeIdx === -1) {
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

function stripBrackets(text: string): string {
	return text.replace(/[[\]]/g, "");
}

const SEARCH_RADIUS = 50;

function mapSpansToRawBlock(
	rawBlock: string,
	spans: BracketedSpan[],
	anchorSurface: string,
	anchorRawOffset: number,
): ResolvedSpan[] | null {
	if (spans.length === 0) return null;

	const anchorSpan = spans.find((span) => span.text === anchorSurface);
	if (!anchorSpan) {
		logger.warn(
			`[multiSpan] anchor surface "${anchorSurface}" not found in spans`,
		);
		return null;
	}

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

	const baseDelta = anchorRawOffset - anchorSpan.strippedStart;
	const resolved: ResolvedSpan[] = [];

	for (const span of spans) {
		if (span === anchorSpan) {
			resolved.push({
				rawEnd: anchorRawOffset + anchorSurface.length,
				rawStart: anchorRawOffset,
				text: span.text,
			});
			continue;
		}

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

		if (isInsideWikilink(rawBlock, found)) {
			logger.warn(
				`[multiSpan] span "${span.text}" at ${found} is inside an existing wikilink - skipping`,
			);
			continue;
		}

		resolved.push({
			rawEnd: found + span.text.length,
			rawStart: found,
			text: span.text,
		});
	}

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

function findNearestMatch(
	haystack: string,
	needle: string,
	estimatedPos: number,
	radius: number,
): number | null {
	if (
		estimatedPos >= 0 &&
		estimatedPos + needle.length <= haystack.length &&
		haystack.slice(estimatedPos, estimatedPos + needle.length) === needle
	) {
		return estimatedPos;
	}

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

function isInsideWikilink(rawBlock: string, pos: number): boolean {
	let i = pos - 1;
	while (i >= 0) {
		if (i > 0 && rawBlock[i - 1] === "]" && rawBlock[i] === "]") {
			return false;
		}
		if (i > 0 && rawBlock[i - 1] === "[" && rawBlock[i] === "[") {
			const closeIdx = rawBlock.indexOf("]]", pos);
			return closeIdx !== -1;
		}
		i--;
	}
	return false;
}

function buildWikilink(surface: string, lemma: string): string {
	return lemma !== surface ? `[[${lemma}|${surface}]]` : `[[${surface}]]`;
}

function applyMultiSpanReplacement(
	rawBlock: string,
	resolvedSpans: ResolvedSpan[],
	lemma: string,
): string {
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
