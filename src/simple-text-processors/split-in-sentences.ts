import { sentences } from 'sbd';
import { wrapTextInBacklinkBlock } from './text-utils';

export function toLinkedSegmentedSentences({
	selection,
	nameOfTheOpenendFile,
	highestBlockNumber,
}: {
	selection: string;
	nameOfTheOpenendFile: string;
	highestBlockNumber: number;
}) {
	const splittedByNewLine = selection.split('\n');

	const formattedLines = [];

	for (const line of splittedByNewLine) {
		// If the line starts with "#" or contains no letters, push as is and continue
		if (line.trim().startsWith('#') || !/\p{L}/u.test(line)) {
			formattedLines.push(line);
			continue;
		}

		const sentencesInLine = segmentWithColonPrepass(line);

		// Build blocks from sentencesInLine, merging short sentences with previous block
		const blockTextsInLine = [];
		for (const sentence of sentencesInLine) {
			const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
			if (wordCount <= 4 && blockTextsInLine.length > 0) {
				blockTextsInLine[blockTextsInLine.length - 1] += ' ' + sentence.trim();
			} else {
				blockTextsInLine.push(sentence.trim());
			}
		}

		blockTextsInLine.forEach((text) => {
			formattedLines.push(
				wrapTextInBacklinkBlock({
					text,
					fileName: nameOfTheOpenendFile,
					linkId: highestBlockNumber,
				})
			);
			highestBlockNumber += 1;
		});
	}
	return formattedLines.join('\n');
}

/**
 * Split at: <non-space><quotation_mark><spaces><Capital|Titlecase|OpeningQuote>
 * e.g. …!" Sie …   or   …" Darauf …   or   …» «Als …
 *
 * Keeps the closing quote on the left chunk and removes the separating spaces.
 */
export function splitOnQuoteEOS(text: string): string[] {
	// Split on the whitespace after a closing quote
	const QUOTE_WS_EOS =
		/(?<=\S\p{Quotation_Mark})\s+(?=(\p{Lu}|\p{Lt}|\p{Pi}|\p{Ps}))/gu;

	const parts: string[] = [];
	let last = 0;

	for (const m of text.matchAll(QUOTE_WS_EOS)) {
		const start = m.index!; // start of the whitespace
		const end = start + m[0].length; // end of the whitespace
		const left = text.slice(last, start).trimEnd();
		if (left) parts.push(left);
		last = end; // skip the whitespace
	}

	const tail = text.slice(last);
	if (tail.trim().length) parts.push(tail);

	return parts;
}

/**
 * Split text on colon-based sentence boundaries.
 * @param keepColon - if true, keep ":" at end of the left chunk.
 */
export function splitOnColonEOS(text: string, keepColon = true): string[] {
	// Colon-as-EOS: not part of a number/time, not a URL scheme, and followed by quote/Upper/Dash
	const COLON_EOS =
		/(?<!\p{Nd})(:)\s+(?!\/\/)(?=(\p{Quotation_Mark}|[\p{Lu}\p{Lt}]|[\p{Dash_Punctuation}—–-]))/gu;

	const parts: string[] = [];
	let last = 0;

	for (const m of text.matchAll(COLON_EOS)) {
		const matchStart = m.index!;
		const matchLen = m[0].length; // ":" + spaces
		const colonPos = matchStart + 1; // position of ":"

		const leftEnd = keepColon ? colonPos : matchStart;
		const rightStart = matchStart + matchLen; // skip the consumed spaces

		const left = text.slice(last, leftEnd).trimEnd();
		if (left) parts.push(left);

		last = rightStart;
	}

	const tail = text.slice(last);
	if (tail.trim().length) parts.push(tail);

	return parts;
}

/** Run sbd on each colon-split chunk and flatten */
export function segmentWithColonPrepass(text: string): string[] {
	const colonChunks = splitOnColonEOS(text, /*keepColon=*/ true);
	const quoteChunks = colonChunks.flatMap((chunk) => splitOnQuoteEOS(chunk));

	return quoteChunks.flatMap((chunk) =>
		sentences(chunk, {
			preserve_whitespace: false,
			newline_boundaries: false,
			html_boundaries: false,
			sanitize: true,
		})
	);
}
