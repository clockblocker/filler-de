import {
	type LemmaRecord,
	makeSurfaceId,
	ParsingError,
	type PendingSemanticRelationRecord,
	parseAsLemmaRecord,
	parseAsPendingSemanticRelationRecord,
	parseAsReadingEntry,
	parseAsSurfaceEntry,
	type ReadingEntry,
	type SurfaceEntry,
} from "dumdict";
import { createPendingSemanticRelationRecord } from "dumdict/pending";
import { lemmaIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { z } from "zod";
import type { RenderingSeal } from "./boundary";
import type { TableVersions } from "./inflection";
import type { CodecIssue, IssueLocation, RecordName } from "./issues";
import type {
	CodecOptions,
	LemmaNoteData,
	ReadingNoteData,
	SurfaceId,
} from "./types";

/**
 * The metadata the codec hands the note-metadata facility (spec: Required
 * model). Each note kind keeps one object under its own key, the dumdict
 * records in the most compact form they can be rebuilt from, and the seals
 * of the renderings its body holds (`rendering`). The facility owns the
 * storage format; the codec owns these shapes and their versions.
 *
 * Records are kept as JSON and validated by dumdict's `parseAs*` parsers on
 * every read, so the schemas below check only the shape around them.
 */

const SealSchema = z.strictObject({
	block: z.string(),
	hash: z.string().regex(/^[0-9a-f]{8}$/u),
	lines: z.number().int().positive(),
});

const SurfaceMetadataSchema = z.strictObject({
	attestations: z.array(z.string()).optional(),
	attestedTranslations: z.array(z.string()).optional(),
	notes: z.string().optional(),
	surface: z.unknown(),
});

const LinkMetadataSchema = z.strictObject({
	ref: z.string(),
	surfaceId: z.string(),
});

const PendingMetadataSchema = z.strictObject({
	relation: z.string(),
	resolvedLemma: z.unknown().optional(),
	target: z.unknown(),
});

/** The pack and Table Schema versions a Lemma note's tables were rendered at. */
const TableVersionsSchema = z.strictObject({
	pack: z.string(),
	schema: z
		.strictObject({ id: z.string(), version: z.number().int() })
		.optional(),
});

/**
 * A Lemma note's metadata: the Lemma, its Lemma Paradigm and its owned
 * Surfaces. A Surface Entry keeps only its Surface and its user content;
 * its id and owner come from the Surface and the note's Lemma. `tables`
 * names the versions its tables were rendered at (#121), and is no record:
 * a note without it was rendered before versions were recorded, or by a
 * hook that names none.
 */
export const LemmaNoteMetadataSchema = z.strictObject({
	lemma: z.unknown(),
	paradigm: z.unknown().optional(),
	rendering: z.array(SealSchema),
	surfaces: z.array(SurfaceMetadataSchema),
	tables: TableVersionsSchema.optional(),
});

/**
 * Why a Reading that stores neither a Breakdown nor a Source asks for
 * neither again (#266): its segmenters found no parts (`NoParts`), or its
 * Source came back Unresolved (`Unresolved`). dumrel stores no "asked,
 * nothing", so the plugin keeps this beside the Knowledge. It goes once
 * the Knowledge holds a Breakdown or a Source, and with the note.
 */
export const BreakdownSettledSchema = z.enum(["NoParts", "Unresolved"]);
export type BreakdownSettled = z.infer<typeof BreakdownSettledSchema>;

/**
 * A Reading note's metadata: the Reading, with its Lemma, so the note names
 * its identity alone; its Knowledge and learner content; its Attestation
 * Links without the Reading each repeats; and the pending relations it is
 * the source of, without the source and locator their Reading gives.
 * `breakdownSettled` is the plugin's, not a dumdict record.
 */
export const ReadingNoteMetadataSchema = z.strictObject({
	attestationLinks: z.array(LinkMetadataSchema).optional(),
	attestedTranslations: z.array(z.string()).optional(),
	breakdownSettled: BreakdownSettledSchema.optional(),
	knowledge: z.unknown().optional(),
	notes: z.string().optional(),
	pendingRelations: z.array(PendingMetadataSchema).optional(),
	reading: z.unknown(),
	rendering: z.array(SealSchema),
});

export type LemmaNoteMetadata = z.infer<typeof LemmaNoteMetadataSchema>;
export type ReadingNoteMetadata = z.infer<typeof ReadingNoteMetadataSchema>;

/**
 * What `defineNestedNamespace` takes (`src/documentaion/note-metadata.md`).
 * The plugin defines its namespaces from these, so the codec never depends
 * on the facility.
 */
export type NoteMetadataSpec<T extends Record<string, unknown>> = {
	readonly name: string;
	readonly key: string;
	readonly version: number;
	readonly schema: z.ZodType<T>;
	readonly migrations: Readonly<Record<number, (data: unknown) => unknown>>;
};

export const LEMMA_NOTE_METADATA: NoteMetadataSpec<LemmaNoteMetadata> = {
	key: "lemmaNote",
	migrations: {},
	name: "lemma-note",
	schema: LemmaNoteMetadataSchema,
	version: 1,
};

export const READING_NOTE_METADATA: NoteMetadataSpec<ReadingNoteMetadata> = {
	key: "readingNote",
	migrations: {},
	name: "reading-note",
	schema: ReadingNoteMetadataSchema,
	version: 1,
};

/** A record as plain JSON data: no `undefined`, no shared references. */
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const nonEmpty = <T>(list: readonly T[]): T[] | undefined =>
	list.length === 0 ? undefined : [...list];

/** Drops the keys whose value is undefined. */
function defined<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, field]) => field !== undefined),
	) as T;
}

export function lemmaNoteMetadataOf<L extends Dumling.Language>(
	data: LemmaNoteData<L>,
	rendering: readonly RenderingSeal[],
	tables?: TableVersions,
): LemmaNoteMetadata {
	const { lemma, paradigm } = data.lemmaRecord;
	return json(
		defined({
			lemma,
			paradigm,
			rendering: [...rendering],
			surfaces: data.ownedSurfaceEntries.map((entry) =>
				defined({
					attestations: nonEmpty(entry.attestations),
					attestedTranslations: nonEmpty(entry.attestedTranslations),
					notes: entry.notes === "" ? undefined : entry.notes,
					surface: entry.surface,
				}),
			),
			tables,
		}),
	);
}

/**
 * The marker a note keeps: none once the Knowledge holds a Breakdown or a
 * Source, which settle the question themselves.
 */
function breakdownSettledOf(
	knowledge:
		| { readonly breakdown?: unknown; readonly source?: unknown }
		| undefined,
	settled: BreakdownSettled | undefined,
): BreakdownSettled | undefined {
	return knowledge?.breakdown === undefined && knowledge?.source === undefined
		? settled
		: undefined;
}

export function readingNoteMetadataOf<L extends Dumling.Language>(
	data: ReadingNoteData<L>,
	rendering: readonly RenderingSeal[],
): ReadingNoteMetadata {
	const { readingEntry: entry, pendingRelations } = data;
	return json(
		defined({
			attestationLinks: nonEmpty(
				entry.attestationLinks.map(({ ref, surfaceId }) => ({
					ref,
					surfaceId,
				})),
			),
			attestedTranslations: nonEmpty(entry.attestedTranslations),
			breakdownSettled: breakdownSettledOf(
				entry.knowledge,
				data.breakdownSettled,
			),
			knowledge: entry.knowledge,
			notes: entry.notes === "" ? undefined : entry.notes,
			pendingRelations: nonEmpty(
				pendingRelations.map(({ pending, resolvedLemma }) =>
					defined({
						relation: pending.relation,
						resolvedLemma,
						target: pending.target,
					}),
				),
			),
			reading: entry.reading,
			rendering: [...rendering],
		}),
	);
}

/** What converting a note's metadata to records came to. */
export type DataResult<T> =
	| { readonly ok: true; readonly data: T }
	| {
			readonly ok: false;
			readonly issues: readonly [CodecIssue, ...CodecIssue[]];
	  };

type Report = (issue: CodecIssue) => void;

/** Metadata that skipped the facility's schema check, and fails it. */
const invalidMetadata = (message: string): DataResult<never> => ({
	issues: [{ _tag: "InvalidMetadata", message }],
	ok: false,
});

/** Runs a dumdict parser, turning its error, or a throw, into an issue. */
function validated<T>(
	record: RecordName,
	at: IssueLocation,
	report: Report,
	parse: () => T | ParsingError,
): T | undefined {
	let parsed: T | ParsingError;
	try {
		parsed = parse();
	} catch (error) {
		parsed =
			error instanceof ParsingError
				? error
				: new ParsingError([
						{ code: "custom", message: String(error), path: [] },
					]);
	}
	if (!(parsed instanceof ParsingError)) return parsed;
	report({
		_tag: "InvalidRecord",
		at,
		issues: parsed.issues,
		message: `The ${record} is invalid: ${parsed.issues.map((issue) => issue.message).join("; ")}`,
		record,
	});
	return undefined;
}

function settle<T>(issues: CodecIssue[], data: T | undefined): DataResult<T> {
	const [first, ...rest] = issues;
	if (first !== undefined) return { issues: [first, ...rest], ok: false };
	if (data === undefined)
		return {
			issues: [
				{
					_tag: "MissingMetadata",
					message: "The note holds no record",
				},
			],
			ok: false,
		};
	return { data, ok: true };
}

/**
 * A Lemma note's records from its metadata, each validated by its dumdict
 * parser. Invariants checked: owned Surfaces are distinct by SurfaceId and
 * realize the note's Lemma.
 */
export function lemmaNoteDataOf<L extends Dumling.Language>(
	stored: LemmaNoteMetadata,
	{ language }: CodecOptions<L>,
): DataResult<LemmaNoteData<L>> {
	const checked = LemmaNoteMetadataSchema.safeParse(stored);
	if (!checked.success) return invalidMetadata(checked.error.message);
	const metadata = checked.data;
	const issues: CodecIssue[] = [];
	const report: Report = (issue) => {
		issues.push(issue);
	};
	const lemmaRecord = validated<LemmaRecord<L>>(
		"LemmaRecord",
		{ field: "lemma" },
		report,
		() =>
			parseAsLemmaRecord(
				defined({ lemma: metadata.lemma, paradigm: metadata.paradigm }),
				language,
			),
	);
	if (lemmaRecord === undefined)
		return settle<LemmaNoteData<L>>(issues, undefined);
	const lemma = lemmaRecord.lemma;
	const ownedSurfaceEntries: SurfaceEntry<L>[] = [];
	const seen = new Set<SurfaceId>();
	metadata.surfaces.forEach((stored, index) => {
		const at = { field: "surfaces", index };
		const entry = validated<SurfaceEntry<L>>(
			"SurfaceEntry",
			at,
			report,
			() =>
				parseAsSurfaceEntry(
					{
						attestations: stored.attestations ?? [],
						attestedTranslations: stored.attestedTranslations ?? [],
						id: makeSurfaceId(
							language,
							stored.surface as Dumling.Surface<L>,
						),
						notes: stored.notes ?? "",
						ownerLemma: lemma,
						surface: stored.surface,
					},
					language,
				),
		);
		if (entry === undefined) return;
		if (lemmaIdentityKey(entry.surface.lemma) !== lemmaIdentityKey(lemma)) {
			report({
				_tag: "InconsistentRecord",
				at,
				message:
					"An owned Surface realizes a different Lemma than the note's",
			});
			return;
		}
		if (seen.has(entry.id)) {
			report({
				_tag: "InconsistentRecord",
				at,
				message: "Two owned Surfaces are one Surface",
			});
			return;
		}
		seen.add(entry.id);
		ownedSurfaceEntries.push(entry);
	});
	return settle(issues, { lemmaRecord, ownedSurfaceEntries });
}

/**
 * A Reading note's records from its metadata, each validated by its dumdict
 * parser. Every pending relation's source is the note's Reading by
 * construction, its locator derived from it.
 */
export function readingNoteDataOf<L extends Dumling.Language>(
	stored: ReadingNoteMetadata,
	{ language }: CodecOptions<L>,
): DataResult<ReadingNoteData<L>> {
	const checked = ReadingNoteMetadataSchema.safeParse(stored);
	if (!checked.success) return invalidMetadata(checked.error.message);
	const metadata = checked.data;
	const issues: CodecIssue[] = [];
	const report: Report = (issue) => {
		issues.push(issue);
	};
	const reading = metadata.reading as Dumling.Reading<L>;
	const readingEntry = validated<ReadingEntry<L>>(
		"ReadingEntry",
		{ field: "reading" },
		report,
		() =>
			parseAsReadingEntry(
				defined({
					attestationLinks: (metadata.attestationLinks ?? []).map(
						(link) => ({ ...link, reading }),
					),
					attestedTranslations: metadata.attestedTranslations ?? [],
					knowledge: metadata.knowledge,
					notes: metadata.notes ?? "",
					reading,
				}),
				language,
			),
	);
	if (readingEntry === undefined)
		return settle<ReadingNoteData<L>>(issues, undefined);
	const pendingRelations: PendingSemanticRelationRecord<L>[] = [];
	(metadata.pendingRelations ?? []).forEach((stored, index) => {
		const { resolvedLemma, ...pending } = stored;
		const record = validated<PendingSemanticRelationRecord<L>>(
			"PendingSemanticRelationRecord",
			{ field: "pendingRelations", index },
			report,
			() =>
				parseAsPendingSemanticRelationRecord(
					defined({
						...createPendingSemanticRelationRecord(
							readingEntry.reading,
							// dumdict validates the reconstructed record.
							pending as Parameters<
								typeof createPendingSemanticRelationRecord<L>
							>[1],
						),
						resolvedLemma,
					}),
					language,
				),
		);
		if (record !== undefined) pendingRelations.push(record);
	});
	return settle(issues, {
		pendingRelations,
		readingEntry,
		...(metadata.breakdownSettled === undefined
			? {}
			: { breakdownSettled: metadata.breakdownSettled }),
	});
}
