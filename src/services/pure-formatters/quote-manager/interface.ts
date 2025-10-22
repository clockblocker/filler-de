import { HASH } from "../../../types/literals";
import {
	extractFormattedLinkedQuote,
	makeFormattedLinkedQuote,
} from "./functions/formatters/linked-quote";
import { segmentWithColonPrepass } from "./functions/segment-with-colon-prepass";
import type { LinkedQuote } from "./types";

type QuotedLine = LinkedQuote | string;

export function segmentInQuotedLines({
	text,
	nameOfTheOpenendFile,
	highestBlockNumber,
}: {
	text: string;
	nameOfTheOpenendFile: string;
	highestBlockNumber: number;
}) {
	const splittedByNewLine = text.split("\n");

	const lines: QuotedLine[] = [];

	let prevLineWasLinkedQuote = false;

	for (const line of splittedByNewLine) {
		// Skip adding extra \n
		if (line.trim().length === 0 && prevLineWasLinkedQuote) {
			prevLineWasLinkedQuote = false;
			continue;
		}

		if (line.trim().startsWith(HASH) || !/\p{L}/u.test(line)) {
			lines.push(line);
			prevLineWasLinkedQuote = false;
			continue;
		}

		// If the line ends with a colon (possibly followed by spaces and optional asterisks), treat as a "speaker says" line and ignore (push as-is)
		if (/:\s*(\*{0,2})\s*$/.test(line)) {
			lines.push(line);
			prevLineWasLinkedQuote = false;
			continue;
		}

		const mbLinkedQuote = extractFormattedLinkedQuote(line);

		if (mbLinkedQuote) {
			lines.push({ ...mbLinkedQuote, fileName: nameOfTheOpenendFile });
			prevLineWasLinkedQuote = true;
			continue;
		}

		const sentencesInLine = segmentWithColonPrepass(line);

		// Build blocks from sentencesInLine, merging short sentences with previous block
		const blockTextsInLine: string[] = [];
		for (const sentence of sentencesInLine) {
			const wordCount = sentence
				.trim()
				.split(/\s+/)
				.filter(Boolean).length;
			if (wordCount <= 4 && blockTextsInLine.length > 0) {
				blockTextsInLine[blockTextsInLine.length - 1] +=
					" " + sentence.trim();
			} else {
				blockTextsInLine.push(sentence.trim());
			}
		}

		blockTextsInLine.forEach((text) => {
			lines.push({
				text,
				fileName: nameOfTheOpenendFile,
				linkId: highestBlockNumber,
			});
			highestBlockNumber += 1;
		});

		prevLineWasLinkedQuote = false;
	}

	return lines;
}

export const formatQuotedLines = (quotedLines: QuotedLine[]): string => {
	return quotedLines
		.map((line) => {
			if (typeof line === "string") {
				return line;
			}
			return makeFormattedLinkedQuote(line);
		})
		.join("\n");
};
