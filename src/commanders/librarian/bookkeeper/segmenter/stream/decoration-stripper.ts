/**
 * Decoration Stripper
 *
 * Strips markdown decorations (italics, bold, etc.) before sentence segmentation,
 * then restores them to each resulting sentence individually.
 *
 * Problem: When text like "*Sentence one. Sentence two.*" is segmented,
 * the decoration markers stay only on outer edges, resulting in:
 *   "*Sentence one." and "Sentence two.*"
 *
 * Solution: Strip decorations → segment → restore to each sentence:
 *   "*Sentence one.*" and "*Sentence two.*"
 */

import type { AnnotatedSentence } from "../../types";

/**
 * Decoration markers ordered by length (longest first) for proper matching.
 */
const DECORATION_MARKERS = ["***", "**", "*", "~~", "=="] as const;

/**
 * Heal unclosed decorations like Obsidian does.
 * Obsidian treats `*text` the same as `*text*` when the decoration is unclosed.
 *
 * Processes line by line: if a line starts with a decoration marker but doesn't
 * end with it, the closing marker is appended.
 *
 * @param text - Input text
 * @returns Text with unclosed decorations healed
 */
export function healUnclosedDecorations(text: string): string {
	return text
		.split("\n")
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed) return line;

			// Check each decoration marker (longest first to avoid partial matches)
			for (const marker of DECORATION_MARKERS) {
				if (trimmed.startsWith(marker) && !trimmed.endsWith(marker)) {
					// Line starts with marker but doesn't end with it
					// Add closing marker (preserve trailing whitespace from original line)
					const trailingWs = line.match(/\s*$/)?.[0] ?? "";
					return line.trimEnd() + marker + trailingWs;
				}
			}
			return line;
		})
		.join("\n");
}

/**
 * Represents a span of decorated text.
 */
export type DecorationSpan = {
	/** Position of opening marker in original text */
	startOffset: number;
	/** Position after closing marker */
	endOffset: number;
	/** The marker string: "*", "**", "***", "~~", "==" */
	decoration: string;
	/** Position where content begins (after open marker) */
	contentStart: number;
	/** Position where content ends (before close marker) */
	contentEnd: number;
};

/**
 * Result of stripping decorations.
 */
export type DecorationStrippingResult = {
	/** Text with decoration markers removed */
	strippedText: string;
	/** Tracked decoration regions */
	spans: DecorationSpan[];
	/**
	 * Map from stripped text offset to original text offset.
	 * Accounts for removed decoration markers.
	 */
	strippedToOriginalOffset: (strippedPos: number) => number;
};

/**
 * Decoration patterns ordered by marker length (longest first).
 * This ensures "***" is matched before "**" before "*".
 */
const DECORATION_PATTERNS: { marker: string; openPattern: RegExp }[] = [
	// Bold+Italic: ***
	{ marker: "***", openPattern: /(?<!\*)\*\*\*(?!\*)/g },
	// Bold: **
	{ marker: "**", openPattern: /(?<!\*)\*\*(?!\*)/g },
	// Italic: * (but not ** or ***)
	{ marker: "*", openPattern: /(?<!\*)\*(?!\*)/g },
	// Strikethrough: ~~
	{ marker: "~~", openPattern: /(?<!~)~~(?!~)/g },
	// Highlight: ==
	{ marker: "==", openPattern: /(?<!=)==(?!=)/g },
];

/**
 * Check if content contains sentence-ending punctuation that would cause
 * Intl.Segmenter to split it into multiple sentences.
 *
 * We look for sentence-ending punctuation followed by whitespace and more content,
 * which indicates multiple potential sentences.
 */
function containsSentenceBoundary(content: string): boolean {
	// Look for: sentence-ending punctuation followed by space and more text
	// This pattern indicates there's likely a sentence boundary inside
	// Patterns that create sentence boundaries:
	// 1. Single period (not part of ellipsis) followed by quotes, space, content
	// 2. ! or ? followed by optional quotes, space, content
	// 3. Ellipsis (... or …) followed by space and content (Intl.Segmenter splits here too)
	return (
		/(?<![.])\.(?![.])["»"']*\s+\S/.test(content) || // single period
		/[!?]["»"']*\s+\S/.test(content) || // ! or ?
		/\.{3}["»"']*\s+\S/.test(content) || // ASCII ellipsis ...
		/…["»"']*\s+\S/.test(content) // Unicode ellipsis …
	);
}

/**
 * Find all decoration spans in text that contain potential sentence boundaries.
 * Spans that contain only a single sentence (no boundary inside) are left alone.
 * Returns spans sorted by start position.
 */
function findDecorationSpans(text: string): DecorationSpan[] {
	const spans: DecorationSpan[] = [];

	for (const { marker, openPattern } of DECORATION_PATTERNS) {
		// Find all occurrences of this marker
		const regex = new RegExp(openPattern.source, "g");
		const positions: number[] = [];

		let match = regex.exec(text);
		while (match !== null) {
			positions.push(match.index);
			match = regex.exec(text);
		}

		// First pass: collect all potential spans for this marker
		const potentialSpans: {
			openPos: number;
			closePos: number;
			content: string;
			hasBoundary: boolean;
		}[] = [];

		// Pair up opening/closing markers
		// Each pair of consecutive markers forms a span
		for (let i = 0; i + 1 < positions.length; i += 2) {
			const openPos = positions[i];
			const closePos = positions[i + 1];

			// Validate positions exist (TS safety)
			if (openPos === undefined || closePos === undefined) continue;

			const contentStart = openPos + marker.length;
			const contentEnd = closePos;
			const content = text.slice(contentStart, contentEnd);
			const hasBoundary = containsSentenceBoundary(content);

			potentialSpans.push({ closePos, content, hasBoundary, openPos });
		}

		// Second pass: determine which spans to strip
		// A span should be stripped if:
		// 1. It contains an internal sentence boundary, OR
		// 2. It's adjacent to another span (they form a chain like *A.* *B.*)
		for (let i = 0; i < potentialSpans.length; i++) {
			const span = potentialSpans[i];
			if (!span) continue;

			const { openPos, closePos, content, hasBoundary } = span;

			// Check if this span has an internal boundary
			let shouldStrip = hasBoundary;

			// Also strip if this span is followed by another span of the same type
			// Pattern: *<content>* *<next>* means spans are adjacent
			if (!shouldStrip) {
				const afterSpan = text.slice(
					closePos + marker.length,
					closePos + marker.length + marker.length + 2, // Enough for whitespace + marker
				);
				// Adjacent if followed by whitespace + same marker
				// Build a regex that matches optional whitespace followed by the marker
				const escapedMarker = marker.replace(
					/[.*+?^${}()|[\]\\]/g,
					"\\$&",
				);
				const adjacentPattern = new RegExp(`^\\s*${escapedMarker}`);
				if (adjacentPattern.test(afterSpan)) {
					shouldStrip = true;
				}
			}

			// Also strip if this span follows another span (preceding span needs stripping too)
			if (!shouldStrip && i > 0) {
				const prevSpan = potentialSpans[i - 1];
				if (prevSpan) {
					const gapStart = prevSpan.closePos + marker.length;
					const gapEnd = openPos;
					const gap = text.slice(gapStart, gapEnd);
					// Adjacent if only whitespace between
					if (/^\s*$/.test(gap)) {
						shouldStrip = true;
					}
				}
			}

			if (!shouldStrip) {
				continue;
			}

			// Skip if this span would overlap with existing spans
			const wouldOverlap = spans.some(
				(existing) =>
					// New span starts inside existing
					(openPos >= existing.startOffset &&
						openPos < existing.endOffset) ||
					// New span ends inside existing
					(closePos >= existing.startOffset &&
						closePos < existing.endOffset) ||
					// New span contains existing
					(openPos < existing.startOffset &&
						closePos + marker.length > existing.endOffset),
			);

			if (wouldOverlap) continue;

			spans.push({
				contentEnd: closePos,
				contentStart: openPos + marker.length,
				decoration: marker,
				endOffset: closePos + marker.length,
				startOffset: openPos,
			});
		}
	}

	// Sort by start position
	spans.sort((a, b) => a.startOffset - b.startOffset);

	return spans;
}

/**
 * Strip decorations from text.
 * Returns stripped text, decoration spans, and offset mapping function.
 */
export function stripDecorations(text: string): DecorationStrippingResult {
	// Find decoration spans (no merging - each span handled independently)
	const spans = findDecorationSpans(text);

	if (spans.length === 0) {
		return {
			spans: [],
			strippedText: text,
			strippedToOriginalOffset: (pos) => pos,
		};
	}

	// Build stripped text and offset map
	// We remove decoration markers but keep the content between them
	let strippedText = "";
	const offsetAdjustments: { strippedPos: number; originalPos: number }[] =
		[];

	let lastEnd = 0;
	let _cumulativeRemoved = 0;

	for (const span of spans) {
		// Add text before this span
		const beforeSpan = text.slice(lastEnd, span.startOffset);
		strippedText += beforeSpan;

		// Record offset at start of span content (after opening marker removed)
		offsetAdjustments.push({
			originalPos: span.contentStart,
			strippedPos: strippedText.length,
		});

		// Add the content (without markers)
		const content = text.slice(span.contentStart, span.contentEnd);
		strippedText += content;

		// Track how much we've removed
		_cumulativeRemoved += span.decoration.length * 2; // Both open and close markers
		lastEnd = span.endOffset;
	}

	// Add remaining text after last span
	strippedText += text.slice(lastEnd);

	// Build offset mapping function
	const strippedToOriginalOffset = (strippedPos: number): number => {
		// Find how much offset adjustment is needed
		let adjustment = 0;

		for (const span of spans) {
			// Calculate where this span's content starts in stripped text
			// by finding cumulative removed markers before it
			let removedBefore = 0;
			for (const s of spans) {
				if (s.startOffset < span.startOffset) {
					removedBefore += s.decoration.length * 2;
				}
			}

			const strippedContentStart =
				span.contentStart - span.decoration.length - removedBefore;
			const strippedContentEnd =
				span.contentEnd - span.decoration.length - removedBefore;

			if (strippedPos < strippedContentStart) {
				// Position is before this span's content
				break;
			}
			if (strippedPos <= strippedContentEnd) {
				// Position is inside this span's content
				// Add back the opening marker
				adjustment = span.decoration.length + removedBefore;
				break;
			}
			// Position is after this span
			adjustment = span.decoration.length * 2 + removedBefore;
		}

		return strippedPos + adjustment;
	};

	// Update spans to reflect stripped positions
	const strippedSpans = spans.map((span) => {
		let removedBefore = 0;
		for (const s of spans) {
			if (s.startOffset < span.startOffset) {
				removedBefore += s.decoration.length * 2;
			}
		}

		return {
			contentEnd:
				span.contentEnd - span.decoration.length - removedBefore,
			contentStart:
				span.contentStart - span.decoration.length - removedBefore,
			decoration: span.decoration,
			endOffset:
				span.endOffset - span.decoration.length * 2 - removedBefore,
			startOffset: span.startOffset - removedBefore,
		};
	});

	return {
		spans: strippedSpans,
		strippedText,
		strippedToOriginalOffset,
	};
}

/**
 * Find which decoration span (if any) contains a given offset.
 */
function findSpanForOffset(
	offset: number,
	spans: DecorationSpan[],
): DecorationSpan | null {
	for (const span of spans) {
		if (offset >= span.startOffset && offset < span.endOffset) {
			return span;
		}
	}
	return null;
}

/**
 * Restore decorations to sentences.
 * Each sentence that falls within a decoration span gets wrapped with that decoration.
 */
export function restoreDecorations(
	sentences: AnnotatedSentence[],
	spans: DecorationSpan[],
): AnnotatedSentence[] {
	if (spans.length === 0) {
		return sentences;
	}

	return sentences.map((sentence) => {
		// Check if this sentence's content (by offset) falls within a decoration span
		const span = findSpanForOffset(sentence.sourceOffset, spans);

		if (!span) {
			return sentence;
		}

		// Wrap the sentence text with the decoration
		let text = sentence.text;
		const trimmedText = text.trim();
		const leadingWhitespace = text.match(/^\s*/)?.[0] || "";
		const trailingWhitespace = text.match(/\s*$/)?.[0] || "";

		// Don't double-wrap if already decorated
		const decoration = span.decoration;
		const alreadyDecorated =
			trimmedText.startsWith(decoration) &&
			trimmedText.endsWith(decoration);

		if (!alreadyDecorated && trimmedText.length > 0) {
			text =
				leadingWhitespace +
				decoration +
				trimmedText +
				decoration +
				trailingWhitespace;
		}

		return {
			...sentence,
			charCount: text.length,
			text,
		};
	});
}
