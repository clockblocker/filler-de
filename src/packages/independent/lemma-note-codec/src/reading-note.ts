import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Result } from "effect";
import { type RetargetedRefLine, retargetedRefLines } from "./attestation-ref";
import {
	type BodySegment,
	BodyWriter,
	freeformOf,
	type RenderingSeal,
	readBody,
	renderingLines,
	trimBlankLines,
} from "./boundary";
import { lemmaTables, tableOfReading } from "./inflection";
import { missingMetadata } from "./issues";
import type { NoteSource } from "./lemma-note";
import { shadowOf } from "./links";
import {
	type DataResult,
	type ReadingNoteMetadata,
	ReadingNoteMetadataSchema,
	readingNoteDataOf,
	readingNoteMetadataOf,
} from "./metadata";
import {
	articleOf,
	claimLinks,
	emojiOf,
	morphemeLinks,
	participleSourceLine,
	pronunciation,
	relationLines,
	type SectionKind,
	sayingTypeLine,
	sectionTitle,
	text,
	translationLines,
	valencyLines,
} from "./render/common";
import {
	checkRecords,
	NoteSerializeError,
	type ReadingNoteContext,
	type RenderOptions,
	renderingOf,
	type SerializedNote,
	type SerializeOptions,
} from "./render/options";
import type { CodecOptions, LemmaRecords, ReadingNoteData } from "./types";

/**
 * The Reading note (spec: Reading note): one per Reading, in its Lemma
 * note's folder. Its metadata holds the Reading Entry, with its Attestation
 * Links, and the pending relations it is the source of. Its body is the
 * user's dictionary layout (#103, #104): the header, then Deine Kontexte,
 * Note, Semantische Beziehungen, Morpheme, Übersetzung, Definition, Valenz,
 * Partizip von, Art, Flexion (an embed of its Licence Group's table in the
 * Lemma note) and Tags. Freeform stands in the Note section.
 */

/** The Reading note text that invites the user to write, while they have not. */
export const NOTE_PLACEHOLDER = "*You can write here*";

/** A Reading note's document layer: its metadata and its body at the rendering boundary. */
export type ReadingNoteDocument = {
	readonly metadata: ReadingNoteMetadata | undefined;
	readonly segments: readonly BodySegment[];
	/**
	 * The refs Deine Kontexte shows by another link path, as Obsidian's link
	 * updater rewrote them when their Scroll moved; absent when it shows
	 * every ref as stored. Their lines still count as the rendering.
	 */
	readonly retargeted?: readonly {
		readonly ref: string;
		readonly linkpath: string;
	}[];
};

export type ReadingNoteParse<L extends Dumling.Language> = {
	readonly document: ReadingNoteDocument;
	readonly data: DataResult<ReadingNoteData<L>>;
};

/**
 * Parses a Reading note: its records from the metadata alone, and its body
 * split at the rendering boundary. It never throws.
 */
export function parseReadingNote<L extends Dumling.Language>(
	note: NoteSource<ReadingNoteMetadata>,
	options: CodecOptions<L>,
): ReadingNoteParse<L> {
	const { body, metadata } = note;
	if (metadata === undefined)
		return {
			data: { issues: missingMetadata(body, "Reading"), ok: false },
			document: { metadata, segments: readBody(body, []) },
		};
	const valid = ReadingNoteMetadataSchema.safeParse(metadata).success;
	const seals = valid ? metadata.rendering : [];
	const segments = readBody(body, seals);
	const retargeted = valid
		? withRetargetedRefs(
				body,
				seals,
				segments,
				(metadata.attestationLinks ?? []).map(({ ref }) => ref),
			)
		: undefined;
	return {
		data: readingNoteDataOf(metadata, options),
		document: {
			metadata,
			...(retargeted ?? { segments }),
		},
	};
}

/** The body's lines with these retargeted lines put back to their stored refs. */
function restored(
	lines: readonly string[],
	retargeted: readonly RetargetedRefLine[],
): string {
	const restoredLines = [...lines];
	for (const { line, ref } of retargeted)
		restoredLines[line] = lines[line]?.endsWith("\r") ? `${ref}\r` : ref;
	return restoredLines.join("\n");
}

/**
 * Deine Kontexte as Obsidian's link updater leaves it after a Scroll
 * moved: each embed of a moved Scroll names it by its new link path, so
 * the rendering no longer matches its seal and would read as freeform.
 * When putting those lines back to the stored refs makes the rendering
 * match, it is the rendering again, and only its own lines count as
 * retargeted; a ref the user copied into their text stays theirs.
 */
function withRetargetedRefs(
	body: string,
	seals: readonly RenderingSeal[],
	segments: readonly BodySegment[],
	refs: readonly string[],
): Pick<Required<ReadingNoteDocument>, "segments" | "retargeted"> | undefined {
	const seal = seals.findIndex(({ block }) => block === "attestation");
	if (
		seal < 0 ||
		segments.some(
			(segment) => segment.type === "rendering" && segment.seal === seal,
		)
	)
		return undefined;
	const lines = body.split("\n");
	const candidates = retargetedRefLines(lines, refs);
	if (candidates.length === 0) return undefined;
	const rendering = readBody(restored(lines, candidates), seals).find(
		(segment) => segment.type === "rendering" && segment.seal === seal,
	);
	if (rendering === undefined) return undefined;
	const inside = candidates.filter(
		({ line }) => rendering.start <= line && line < rendering.end,
	);
	return {
		retargeted: inside.map(({ linkpath, ref }) => ({ linkpath, ref })),
		segments: readBody(restored(lines, inside), seals),
	};
}

/** The Reading Knowledge aspect each rendered Block shows. */
const KNOWLEDGE_BLOCKS = {
	definition: "definition",
	formula_role: "formulaRole",
	locution_type: "locutionType",
	morphology: "morphologicalTree",
	participle_source: "participleSource",
	relation: "semanticRelations",
	saying_type: "sayingType",
	transcription: "transcription",
	translation: "translations",
	valency: "valency",
} as const satisfies Record<string, keyof Dumrel.ReadingKnowledge>;

/** Fails to compile when dumrel adds a Knowledge aspect no Block shows. */
type MissingAspects = Exclude<
	keyof Dumrel.ReadingKnowledge,
	(typeof KNOWLEDGE_BLOCKS)[keyof typeof KNOWLEDGE_BLOCKS]
>;
const everyAspectShows: [MissingAspects] extends [never] ? true : never = true;
void everyAspectShows;

/**
 * Writes the note of `reading`, one of `records`' Readings: its Reading
 * Entry and the pending relations it is the source of, rendered in the
 * user's layout, with the freeform of `options.previous` in its Note
 * section. A freeform text holding only the Note placeholder is dropped. It
 * fails with a `NoteSerializeError` for records no valid note holds, or
 * when `records` holds no such Reading.
 */
export function serializeReadingNote<L extends Dumling.Language>(
	records: LemmaRecords<L>,
	reading: Dumling.Reading<L>,
	options: SerializeOptions<L> = {},
): Result.Result<SerializedNote<ReadingNoteMetadata>, NoteSerializeError> {
	const invalid = checkRecords(records);
	if (invalid) return Result.fail(invalid);
	const key = readingIdentityKey(reading);
	const entry = records.readingEntries.find(
		(candidate) => readingIdentityKey(candidate.reading) === key,
	);
	if (entry === undefined)
		return Result.fail(
			new NoteSerializeError({
				message: "The Reading is not one of its Lemma's",
			}),
		);
	const pendingRelations = records.pendingRelations.filter(
		(record) => readingIdentityKey(record.sourceReading) === key,
	);
	const { link, paths, titles } = renderingOf(options);
	const { lemma } = records.lemmaRecord;
	const context: ReadingNoteContext<L> = { entry, lemma, records };
	const knowledge = entry.knowledge;
	const writer = new BodyWriter();

	/** Blocks of one section: its title opens the first one that shows. */
	const section = (
		kind: SectionKind,
		blocks: readonly (readonly [string, readonly string[]])[],
	) => {
		let titled = false;
		for (const [block, lines] of blocks) {
			if (lines.length === 0) continue;
			const title = titled ? [] : sectionTitle(kind, titles);
			titled = true;
			writer.block({ block, lines: [...title, ...lines] });
		}
	};

	const emoji = emojiOf(entry.reading);
	const article = articleOf(lemma);
	const name = link({ names: { kind: "Lemma", lemma }, role: "header" });
	const transcription = knowledge?.transcription;
	writer.block({
		block: "header",
		lines: renderingLines(
			[
				emoji,
				article,
				transcription === undefined
					? name
					: `${name}, ${pronunciation(lemma, transcription)}`,
			]
				.filter((part) => part !== undefined)
				.join(" "),
		),
	});
	writer.gap(1);

	section("kontexte", [
		[
			"attestation",
			renderingLines(
				entry.attestationLinks.map(({ ref }) => ref).join("\n\n"),
				true,
			),
		],
	]);

	const freeform = freeformOf(options.previous?.segments ?? [])
		.map(trimBlankLines)
		.filter(
			(written) =>
				written.trim().length > 0 &&
				written.trim() !== NOTE_PLACEHOLDER,
		);
	writer.block({ block: "notes_title", lines: sectionTitle("note", titles) });
	writer.block({ block: "notes", lines: renderingLines(entry.notes, true) });
	if (freeform.length > 0) writer.text(freeform.join("\n\n"));
	else if (entry.notes.trim().length === 0)
		writer.block({ block: "notes_placeholder", lines: [NOTE_PLACEHOLDER] });
	writer.gap(2);

	const shown = new Set<string>();
	const unresolved = pendingRelations.filter(
		({ resolvedLemma }) => resolvedLemma === undefined,
	);
	section("synonyme", [
		[
			"relation",
			relationLines(
				claimLinks(knowledge?.semanticRelations, link),
				shown,
			),
		],
		// A resolved Shadow relation shows through its direct claim alone.
		[
			"pending_relation",
			relationLines(
				unresolved.map(({ pending }) => [
					pending.relation,
					[
						link({
							names: {
								kind: "Shadow",
								shadow: pending.target as typeof pending.target & {
									language: L;
								},
							},
							role: "pendingRelation",
						}),
					],
				]),
				shown,
			),
		],
		[
			"inverse_relation",
			relationLines(
				(options.inverseRelations?.(context) ?? []).map(
					({ relation, target }) => [
						relation,
						[
							link({
								names: {
									kind: "Shadow",
									shadow: shadowOf(
										(target.unitKind === "Reading"
											? (target as Dumling.Reading<L>)
													.lemma
											: target) as Dumling.Lemma<L>,
									),
								},
								role: "inverseRelation",
							}),
						],
					],
				),
				shown,
			),
		],
	]);

	const tree = knowledge?.morphologicalTree as { root?: unknown } | undefined;
	section("morpheme", [
		[
			"morphology",
			tree === undefined
				? []
				: [morphemeLinks(tree.root, link).join("|")],
		],
	]);

	const translated = new Set(
		Object.values(knowledge?.translations ?? {}).flat() as string[],
	);
	const attested = entry.attestedTranslations.filter(
		(word) => !translated.has(word),
	);
	section("translations", [
		["translation", translationLines(knowledge?.translations)],
		[
			"attested_translation",
			attested.length === 0
				? []
				: renderingLines(`*${attested.join(", ")}*`),
		],
	]);
	section("definition", [
		[
			"definition",
			knowledge?.definition === undefined
				? []
				: renderingLines(text(knowledge.definition), true),
		],
	]);
	section("valenz", [["valency", valencyLines(knowledge?.valency, link)]]);
	section("partizip", [
		[
			"participle_source",
			knowledge?.participleSource === undefined
				? []
				: [participleSourceLine(knowledge.participleSource, link)],
		],
	]);
	section("art", [
		[
			"locution_type",
			knowledge?.locutionType === undefined
				? []
				: [text(knowledge.locutionType)],
		],
		[
			"saying_type",
			knowledge?.sayingType === undefined
				? []
				: [sayingTypeLine(knowledge.sayingType)],
		],
		[
			"formula_role",
			knowledge?.formulaRole === undefined
				? []
				: [text(knowledge.formulaRole)],
		],
	]);

	const table = tableOfReading(
		lemmaTables(options.inflection, { link, records }),
		entry.reading,
	);
	const lemmaPath = paths.lemma(lemma);
	section("flexion", [
		[
			"inflection_embed",
			table === undefined || lemmaPath === undefined
				? []
				: [
						`![[${lemmaPath}#^${table.blockId}|${lemma.canonicalForm}]]`,
					],
		],
	]);

	const tags = options.tags?.(context) ?? [];
	section("tags", [
		[
			"tags",
			tags.length === 0 ? [] : [tags.map((tag) => `#${tag}`).join(" ")],
		],
	]);

	const { body, rendering } = writer.finish();
	return Result.succeed({
		body,
		metadata: readingNoteMetadataOf(
			{ pendingRelations, readingEntry: entry },
			rendering,
		),
	});
}

/** A Reading note's visible body, as {@link serializeReadingNote} writes it with no previous note. */
export function renderReadingNote<L extends Dumling.Language>(
	records: LemmaRecords<L>,
	reading: Dumling.Reading<L>,
	options: RenderOptions<L> = {},
): Result.Result<string, NoteSerializeError> {
	return Result.map(
		serializeReadingNote(records, reading, options),
		({ body }) => body,
	);
}
