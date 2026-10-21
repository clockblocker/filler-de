/**
 * Dictionary notes as files (#112): the Lemma note codec over the
 * note-metadata facility. A note's records live in its namespace, its
 * visible body is the codec's, and every write is a pure transform, so the
 * dictionary store runs it inside its compare-and-swap and VAM inside
 * `Vault.process`.
 */

import {
	type CodecOptions,
	type LemmaNoteParse,
	type LemmaRecords,
	parseLemmaNote,
	parseReadingNote,
	type ReadingNoteParse,
	type SerializeOptions,
	serializeLemmaNote,
	serializeReadingNote,
} from "@textfresser/lemma-note-codec";
import type * as Dumling from "dumling/types";
import {
	LemmaNoteMetadata,
	type MetadataFormat,
	type MetadataIssue,
	type MetadataNamespace,
	type MetadataTransform,
	NoteMetadataError,
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "./note-metadata";

/** A note's file read as a dictionary note. */
export type DictionaryNoteRead<P> =
	| {
			/** The codec's parse; its data reports a note with no data of its kind. */
			readonly _tag: "Parsed";
			readonly parse: P;
	  }
	| {
			/** The namespace holds data the facility cannot read, such as a newer version. */
			readonly _tag: "UnreadableMetadata";
			readonly issue: MetadataIssue;
			readonly format: MetadataFormat;
	  };

function readNote<M, P>(
	content: string,
	namespace: MetadataNamespace<M>,
	parse: (note: { body: string; metadata: M | undefined }) => P,
	prefer: MetadataFormat | undefined,
): DictionaryNoteRead<P> {
	const reading = noteMetadataHelper.inspect(content, namespace, prefer);
	if (reading.kind === "Invalid")
		return {
			_tag: "UnreadableMetadata",
			format: reading.format,
			issue: reading.issue,
		};
	return {
		_tag: "Parsed",
		parse: parse({
			body: noteMetadataHelper.body(content),
			metadata: reading.kind === "Valid" ? reading.value : undefined,
		}),
	};
}

/** Reads a Lemma note's file. `prefer` is the format tried first. */
export function readLemmaNote<L extends Dumling.Language>(
	content: string,
	options: CodecOptions<L>,
	prefer?: MetadataFormat,
): DictionaryNoteRead<LemmaNoteParse<L>> {
	return readNote(
		content,
		LemmaNoteMetadata,
		(note) => parseLemmaNote(note, options),
		prefer,
	);
}

/** Reads a Reading note's file. `prefer` is the format tried first. */
export function readReadingNote<L extends Dumling.Language>(
	content: string,
	options: CodecOptions<L>,
	prefer?: MetadataFormat,
): DictionaryNoteRead<ReadingNoteParse<L>> {
	return readNote(
		content,
		ReadingNoteMetadata,
		(note) => parseReadingNote(note, options),
		prefer,
	);
}

export type WriteOptions<L extends Dumling.Language> = Omit<
	SerializeOptions<L>,
	"previous"
> & {
	readonly language: L;
	/** Where the metadata goes; the format "Hide metadata" selects by default. */
	readonly format?: MetadataFormat;
};

function writeNote<P extends { readonly document: unknown }, M>(
	namespace: MetadataNamespace<M>,
	read: (content: string) => DictionaryNoteRead<P>,
	serialize: (previous: P["document"] | undefined) => {
		readonly body: string;
		readonly metadata: M;
	},
	format: MetadataFormat | undefined,
): MetadataTransform {
	return (content) => {
		const current = read(content);
		if (current._tag === "UnreadableMetadata")
			throw new NoteMetadataError(namespace.name, {
				issue: current.issue,
				kind: "UnreadableData",
			});
		const { body, metadata } = serialize(current.parse.document);
		const withBody = noteMetadataHelper.mapBody(() => body)(content);
		return noteMetadataHelper.write(namespace, metadata, format)(withBody);
	};
}

/**
 * Rewrites a file as the Lemma note of `records`, keeping the user's
 * freeform text and frontmatter properties. Throws `NoteMetadataError`
 * rather than overwrite metadata it cannot read.
 */
export function writeLemmaNote<L extends Dumling.Language>(
	records: LemmaRecords<L>,
	{ format, language, ...options }: WriteOptions<L>,
): MetadataTransform {
	return writeNote(
		LemmaNoteMetadata,
		(content) => readLemmaNote(content, { language }, format),
		(previous) =>
			serializeLemmaNote(records, {
				...options,
				...(previous === undefined ? {} : { previous }),
			}),
		format,
	);
}

/**
 * Rewrites a file as the Reading note of `reading`, one of `records`'
 * Readings, keeping the user's freeform text in its Note section and the
 * user's frontmatter properties.
 */
export function writeReadingNote<L extends Dumling.Language>(
	records: LemmaRecords<L>,
	reading: Dumling.Reading<L>,
	{ format, language, ...options }: WriteOptions<L>,
): MetadataTransform {
	return writeNote(
		ReadingNoteMetadata,
		(content) => readReadingNote(content, { language }, format),
		(previous) =>
			serializeReadingNote(records, reading, {
				...options,
				...(previous === undefined ? {} : { previous }),
			}),
		format,
	);
}
