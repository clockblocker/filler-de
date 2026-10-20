import type * as Dumling from "dumling/types";
import { documentToData, type LemmaNoteDataResult } from "./data";
import { type LemmaNoteDocument, parseDocument } from "./document";
import type { CodecOptions } from "./types";

export type LemmaNoteParse<L extends Dumling.Language> = {
	readonly document: LemmaNoteDocument;
	readonly data: LemmaNoteDataResult<L>;
};

/**
 * Parses a Lemma note into its document and its validated dumdict records.
 * It never throws: an invalid note comes back with `data.ok === false`, its
 * issues, and the records that did validate, for the store to quarantine.
 */
export function parse<L extends Dumling.Language>(
	markdown: string,
	options: CodecOptions<L>,
): LemmaNoteParse<L> {
	const document = parseDocument(markdown);
	return { data: documentToData(document, options), document };
}
