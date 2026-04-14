export * from "./model";

import { dataToDocument } from "./data/data-to-document";
import {
	documentToDataLoose,
	documentToDataStrict,
} from "./data/document-to-data";
import { normalizeDocument } from "./document/normalize-document";
import {
	parseDocumentLoose,
	parseDocumentStrict,
} from "./document/parse-document";
import { serializeDocument } from "./document/serialize-document";
import type { CodecIssue } from "./model/issues";
import type { NoteData, PartialNoteData } from "./model/note";
import type { ParseOptions, SerializeOptions } from "./model/options";

export {
	dataToDocument,
	documentToDataLoose,
	documentToDataStrict,
	normalizeDocument,
	parseDocumentLoose,
	parseDocumentStrict,
	serializeDocument,
};

export function parseDataStrict(
	markdown: string,
	options?: ParseOptions,
): NoteData {
	return documentToDataStrict(
		parseDocumentStrict(markdown, options),
		options,
	);
}

export function parseDataLoose(
	markdown: string,
	options?: ParseOptions,
): {
	data: PartialNoteData;
	issues: CodecIssue[];
} {
	const parsed = parseDocumentLoose(markdown, options);
	const reconstructed = documentToDataLoose(parsed.document, options);
	return {
		data: reconstructed.data,
		issues: [...parsed.issues, ...reconstructed.issues],
	};
}

export function serializeData(
	data: NoteData,
	options?: SerializeOptions,
): string {
	return serializeDocument(dataToDocument(data), options);
}

export function normalizeData(
	data: NoteData,
	options?: ParseOptions,
): {
	data: NoteData;
	issues: CodecIssue[];
} {
	const normalizedDocument = normalizeDocument(
		dataToDocument(data, options),
		options,
	);
	const normalizedData = documentToDataStrict(
		normalizedDocument.document,
		options,
	);
	return { data: normalizedData, issues: normalizedDocument.issues };
}
