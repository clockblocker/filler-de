import { sentences } from 'sbd';
import { splitOnDoubleColon } from './splitters/split-on-colon';
import { splitOnQuote } from './splitters/split-on-quote';

/** Run sbd on each colon-split chunk and flatten */
export function segmentWithColonPrepass(text: string): string[] {
	const colonChunks = splitOnDoubleColon(text, /*keepColon=*/ true);
	const quoteChunks = colonChunks.flatMap((chunk) => splitOnQuote(chunk));

	return quoteChunks.flatMap((chunk) =>
		sentences(chunk, {
			preserve_whitespace: false,
			newline_boundaries: false,
			html_boundaries: false,
			sanitize: true,
		})
	);
}
