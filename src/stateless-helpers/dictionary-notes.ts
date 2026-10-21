/**
 * Dictionary notes as files (#112): the Lemma note codec over the
 * note-metadata facility. A note's records live in its namespace, its
 * visible body is the codec's, and every write is a pure transform, so the
 * dictionary store runs it inside its compare-and-swap and VAM inside
 * `Vault.process`.
 */

import {
	type BodySegment,
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
	/**
	 * User text to place as freeform after the note's own, kept byte for
	 * byte: text moved from a removed note, or text a caller adds.
	 */
	readonly extraFreeform?: readonly string[];
};

/** Text without CRs, blank edge lines and trailing whitespace. */
function normalizeFreeform(text: string): string {
	return text
		.replace(/\r\n?/gu, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/u, ""))
		.join("\n")
		.replace(/^\n+|\n+$/gu, "");
}

/**
 * Whether `text` already stands, as whole paragraphs, in one of these
 * freeform runs: all of a run, or a run of it between blank lines. Text
 * placed next to other freeform parses back as one run, so a placement is
 * found again this way, while a short text inside a longer paragraph is not
 * mistaken for it.
 */
export function holdsFreeformText(
	freeform: readonly string[],
	text: string,
): boolean {
	const body = normalizeFreeform(text);
	return freeform.some((run) => {
		const held = normalizeFreeform(run);
		return (
			held === body ||
			held.startsWith(`${body}\n\n`) ||
			held.endsWith(`\n\n${body}`) ||
			held.includes(`\n\n${body}\n\n`)
		);
	});
}

/**
 * The parts of `extra` a note's freeform does not hold yet, paragraph by
 * paragraph, so text moved again after a partial move, such as a retried
 * write, lands once.
 */
export function freeformToAdd(
	held: readonly string[],
	extra: readonly string[],
): string[] {
	const kept = [...held];
	const added: string[] = [];
	for (const text of extra) {
		const paragraphs = normalizeFreeform(text)
			.split(/\n{2,}/u)
			.filter((paragraph) => !holdsFreeformText(kept, paragraph));
		if (paragraphs.length === 0) continue;
		const joined = paragraphs.join("\n\n");
		added.push(joined);
		kept.push(joined);
	}
	return added;
}

/**
 * A previous document with `extra` placed after its own freeform. Text it
 * already holds is not added again, so a write that is retried, or text
 * moved twice, stays once.
 */
function withExtraFreeform<
	D extends { readonly segments: readonly BodySegment[] },
>(
	previous: D | undefined,
	extra: readonly string[] | undefined,
): { readonly segments: readonly BodySegment[] } | undefined {
	const segments = previous?.segments ?? [];
	const held = segments.flatMap((segment) =>
		segment.type === "freeform" ? [segment.text] : [],
	);
	const added = freeformToAdd(held, extra ?? []);
	if (added.length === 0) return previous;
	const end = segments.at(-1)?.end ?? 0;
	return {
		segments: [
			...segments,
			...added.map(
				(text, index): BodySegment => ({
					end: end + index + 1,
					start: end + index,
					text,
					type: "freeform",
				}),
			),
		],
	};
}

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
	{ extraFreeform, format, language, ...options }: WriteOptions<L>,
): MetadataTransform {
	return writeNote(
		LemmaNoteMetadata,
		(content) => readLemmaNote(content, { language }, format),
		(document) => {
			const previous = withExtraFreeform(document, extraFreeform);
			return serializeLemmaNote(records, {
				...options,
				...(previous === undefined ? {} : { previous }),
			});
		},
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
	{ extraFreeform, format, language, ...options }: WriteOptions<L>,
): MetadataTransform {
	return writeNote(
		ReadingNoteMetadata,
		(content) => readReadingNote(content, { language }, format),
		(document) => {
			const previous = withExtraFreeform(document, extraFreeform);
			return serializeReadingNote(records, reading, {
				...options,
				...(previous === undefined ? {} : { previous }),
			});
		},
		format,
	);
}
