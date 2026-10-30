import type * as Dumling from "dumling/types";
import { Result } from "effect";
import { surfaceBlockIds, withoutBlockIds } from "./block-ids";
import {
	type BodySegment,
	BodyWriter,
	freeformOf,
	type RenderedBlock,
	readBody,
	renderingLines,
	trimBlankLines,
} from "./boundary";
import { lemmaTables, tableVersionsOf } from "./inflection";
import { missingMetadata } from "./issues";
import { shadowOf } from "./links";
import {
	type DataResult,
	type LemmaNoteMetadata,
	LemmaNoteMetadataSchema,
	lemmaNoteDataOf,
	lemmaNoteMetadataOf,
} from "./metadata";
import { articleOf, emojiOf, sectionTitle } from "./render/common";
import { formationLines } from "./render/formations";
import {
	checkRecords,
	type NoteSerializeError,
	type RenderOptions,
	renderingOf,
	type SerializedNote,
	type SerializeOptions,
} from "./render/options";
import type {
	CodecOptions,
	LemmaNoteData,
	LemmaRecords,
	SurfaceId,
} from "./types";

/**
 * The Lemma note (spec: Lemma note): one per Lemma, also the note of its
 * base-form Surface. Its metadata holds the Lemma Record, with its Lemma
 * Paradigm, and every owned Surface Entry. Its body shows, in this order:
 *
 * ```
 * die [[Worter/m/mut/mutte/mutter|Mutter]]                  header
 *
 * [[…/👩 Mutter|👩]]                                          one line per Reading note
 * [[…/🔩 Mutter|🔩]]
 *
 * <span …flexion>Flexion</span>
 *
 * 👩                                                          one table per Licence Group,
 * N: die Mutter, die Mütter                                   captioned with its emojis,
 * ^t-1a2b3c4d                                                 each one Obsidian block
 *
 * <span …surfaces>Begegnete Formen</span>
 * - Mütter: Nom.Pl ^s-5e6f7a8b                                one list item per met Surface
 *
 * <span …formations>Wortbildung</span>
 * Komposita: [[…/🏭 Kohlekraftwerk|Kohlekraftwerk]]          one line per group of Formations
 *
 * <freeform>
 * ```
 */

/** A Lemma note's document layer: its metadata and its body at the rendering boundary. */
export type LemmaNoteDocument = {
	readonly metadata: LemmaNoteMetadata | undefined;
	readonly segments: readonly BodySegment[];
};

/** Block IDs a Lemma note's data gives its Surface lines. Recomputed, never stored. */
export type LemmaNoteBlockIds = {
	readonly surfaces: ReadonlyMap<SurfaceId, string>;
};

export type LemmaNoteDataResult<L extends Dumling.Language> =
	| (Extract<DataResult<LemmaNoteData<L>>, { ok: true }> & {
			readonly blockIds: LemmaNoteBlockIds;
	  })
	| Extract<DataResult<LemmaNoteData<L>>, { ok: false }>;

export type LemmaNoteParse<L extends Dumling.Language> = {
	readonly document: LemmaNoteDocument;
	readonly data: LemmaNoteDataResult<L>;
};

/** A note's visible body and its metadata, as the facility hands them over. */
export type NoteSource<M> = {
	readonly body: string;
	/** The note kind's namespace value, or undefined when the note has none. */
	readonly metadata: M | undefined;
};

/**
 * Parses a Lemma note: its records from the metadata alone, and its body
 * split at the rendering boundary. It never throws; a note without Lemma
 * note data, such as one in the retired marker format, comes back with
 * `data.ok === false` and typed issues.
 */
export function parseLemmaNote<L extends Dumling.Language>(
	note: NoteSource<LemmaNoteMetadata>,
	options: CodecOptions<L>,
): LemmaNoteParse<L> {
	const { body, metadata } = note;
	if (metadata === undefined)
		return {
			data: { issues: missingMetadata(body, "Lemma"), ok: false },
			document: { metadata, segments: readBody(body, []) },
		};
	const data = lemmaNoteDataOf(metadata, options);
	const seals = LemmaNoteMetadataSchema.safeParse(metadata).success
		? metadata.rendering
		: [];
	const document = { metadata, segments: readBody(body, seals) };
	if (!data.ok) return { data, document };
	return {
		data: {
			...data,
			blockIds: {
				surfaces: surfaceBlockIds(data.data.ownedSurfaceEntries),
			},
		},
		document,
	};
}

/**
 * Writes a Lemma note from its Lemma's records: the header, the links to
 * its Reading notes, its tables, its Surface lines and its Formations, then
 * the freeform of `options.previous`, kept byte for byte but for the
 * codec-owned Block IDs an edited rendering still carries. Its metadata records the versions
 * `options.inflection` renders the tables at. It fails with a
 * `NoteSerializeError` for records no valid note holds.
 */
export function serializeLemmaNote<L extends Dumling.Language>(
	records: LemmaRecords<L>,
	options: SerializeOptions<L> = {},
): Result.Result<SerializedNote<LemmaNoteMetadata>, NoteSerializeError> {
	const invalid = checkRecords(records);
	if (invalid) return Result.fail(invalid);
	const { link, titles } = renderingOf(options);
	const { lemma } = records.lemmaRecord;
	const writer = new BodyWriter();

	const article = articleOf(lemma);
	const name = link({
		names: { kind: "Shadow", shadow: shadowOf(lemma) },
		role: "header",
	});
	writer.block({
		block: "header",
		lines: renderingLines(
			article === undefined ? name : `${article} ${name}`,
		),
	});

	const readingLines = records.readingEntries.map(({ reading }) =>
		link(
			{ names: { kind: "Reading", reading }, role: "reading" },
			emojiOf(reading) ?? lemma.canonicalForm,
		),
	);
	if (readingLines.length > 0)
		writer.gap(1).block({ block: "readings", lines: readingLines });

	const { surfaceAxes, tables } = lemmaTables(options.inflection, {
		link,
		records,
	});
	if (tables.length > 0) {
		writer.gap(1).block({
			block: "flexion_title",
			lines: sectionTitle("flexion", titles),
		});
		for (const table of tables) {
			const caption = table.readings
				.map((reading) => emojiOf(reading))
				.filter((emoji) => emoji !== undefined)
				.join(" ");
			writer.gap(1).block({
				block: "inflection",
				lines: [
					...(caption.length > 0 ? [caption] : []),
					...renderingLines(table.lines.join("\n")),
					`^${table.blockId}`,
				],
			});
		}
	}

	const ids = surfaceBlockIds(records.ownedSurfaceEntries);
	const surfaceLines: RenderedBlock[] = records.ownedSurfaceEntries.map(
		(entry, index) => {
			const axes = surfaceAxes.get(entry.id);
			const shown = `${entry.surface.normalizedSurface}${axes === undefined || axes.length === 0 ? "" : `: ${axes}`}`;
			return {
				block: "surface",
				lines: [
					...(index === 0 ? sectionTitle("surfaces", titles) : []),
					`- ${renderingLines(shown).join(" ")} ^${ids.get(entry.id)}`,
				],
			};
		},
	);
	if (surfaceLines.length > 0) writer.gap(1);
	for (const line of surfaceLines) writer.block(line);

	const formations = formationLines(options.formations?.(lemma) ?? [], link);
	if (formations.length > 0) writer.gap(1);
	for (const [index, line] of formations.entries())
		writer.block({
			block: "formations",
			lines: [
				...(index === 0 ? sectionTitle("formations", titles) : []),
				renderingLines(line).join(" "),
			],
		});

	const freeform = freeformOf(options.previous?.segments ?? [])
		.map((text) => trimBlankLines(withoutBlockIds(text)))
		.filter((text) => text.trim().length > 0);
	if (freeform.length > 0) writer.gap(1).text(freeform.join("\n\n"));

	const { body, rendering } = writer.finish();
	return Result.succeed({
		body,
		metadata: lemmaNoteMetadataOf(
			{
				lemmaRecord: records.lemmaRecord,
				ownedSurfaceEntries: records.ownedSurfaceEntries,
			},
			rendering,
			tableVersionsOf(options.inflection, lemma),
		),
	});
}

/** A Lemma note's visible body, as {@link serializeLemmaNote} writes it with no previous note. */
export function renderLemmaNote<L extends Dumling.Language>(
	records: LemmaRecords<L>,
	options: RenderOptions<L> = {},
): Result.Result<string, NoteSerializeError> {
	return Result.map(serializeLemmaNote(records, options), ({ body }) => body);
}
