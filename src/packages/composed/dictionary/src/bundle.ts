/**
 * TODO(#113): the interim one-file-per-Lemma layout, a Lemma Bundle.
 *
 * The note codec writes a Lemma note and one Reading note per Reading
 * (#112), but this store still keeps one file per Lemma at its ADR-0013
 * path, and Classify still links `[[<lemma path>#^r-<hash>|…]]` (#116).
 * Until #113 commits Lemma, Reading and Crossroad notes together, a file
 * holds its Lemma's notes one after another, as the old entries stood:
 *
 * ```
 * <the Lemma note's body>
 *
 * ***
 * ***
 * <each Reading note's body, its header ending in ^r-<hash>>
 * ```
 *
 * Its metadata, `lemmaBundle`, holds each note's codec metadata. No inline
 * markers: the seals of every rendering, the separators' included, live in
 * the metadata, and every other line is freeform of the note it follows.
 */

import {
	assignBlockIds,
	type BodySegment,
	type CodecIssue,
	DEFAULT_PATHS,
	LemmaNoteMetadataSchema,
	lemmaNoteDataOf,
	linesOf,
	type NotePaths,
	type PreviousDocument,
	ReadingNoteMetadataSchema,
	type RenderingSeal,
	type RenderOptions,
	readBody,
	readingNoteDataOf,
	sealOf,
	serializeLemmaNote,
	serializeReadingNote,
	sha256Hex,
} from "@textfresser/lemma-note-codec";
import type { PendingSemanticRelationRecord, ReadingEntry } from "dumdict";
import { lemmaIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { z } from "zod";
import {
	defineNestedNamespace,
	type MetadataFormat,
	noteMetadataHelper,
} from "./internal/note-metadata";
import { readingKeyOf } from "./keys";
import type { NoteData } from "./note-entry";
import { canonicalLemmaPath } from "./note-index";

const BundleSchema = z.strictObject({
	lemma: LemmaNoteMetadataSchema,
	readings: z.array(ReadingNoteMetadataSchema),
});

/** The `lemmaBundle` namespace. TODO(#113): the store writes `lemmaNote` and `readingNote`. */
export const LemmaBundleMetadata = defineNestedNamespace({
	escapeLinksInFrontmatter: true,
	key: "lemmaBundle",
	migrations: {},
	name: "lemma-bundle",
	schema: BundleSchema,
	version: 1,
});

/** What the codec renders into every bundle the store writes. */
export type BundleRender = Omit<RenderOptions<"de">, "paths">;

/** The lines that open every Reading's part, as the old entries were separated. */
const SEPARATOR = { block: "separator", lines: ["***", "***"] } as const;
const SEPARATOR_SEAL = sealOf(SEPARATOR);

const READING_BLOCK_ID_PREFIX = "r-";

/** A Reading's Block ID as another note links it: the unlengthened hash. */
function readingBlockId(reading: Dumling.Reading): string {
	return `${READING_BLOCK_ID_PREFIX}${sha256Hex(readingKeyOf(reading)).slice(0, 8)}`;
}

/** The Block ID of each Reading's header in its Lemma's bundle, by Reading key. */
export function readingBlockIds(
	readings: readonly Dumling.Reading[],
): Map<string, string> {
	return assignBlockIds(READING_BLOCK_ID_PREFIX, readings.map(readingKeyOf));
}

/**
 * Bundle paths: a Lemma at its ADR-0013 path, a Reading at its header's
 * Block in its Lemma's bundle, and a spelling at its Crossroad path.
 */
function bundlePaths(
	lemma: Dumling.Lemma<"de">,
	ids: ReadonlyMap<string, string>,
): NotePaths<"de"> {
	const lemmaPath = (target: Dumling.Lemma<"de">) =>
		canonicalLemmaPath(target)?.replace(/\.md$/u, "");
	const own = lemmaIdentityKey(lemma);
	return {
		lemma: lemmaPath,
		reading: (reading) => {
			const path = lemmaPath(reading.lemma);
			if (path === undefined) return undefined;
			const id =
				lemmaIdentityKey(reading.lemma) === own
					? ids.get(readingKeyOf(reading))
					: undefined;
			return `${path}#^${id ?? readingBlockId(reading)}`;
		},
		spelling: DEFAULT_PATHS.spelling,
	};
}

type BundleData =
	| {
			readonly ok: true;
			readonly data: NoteData;
			/** Each Reading's header Block ID, by Reading key. */
			readonly readingBlockIds: ReadonlyMap<string, string>;
	  }
	| { readonly ok: false; readonly issues: readonly CodecIssue[] };

/** A bundle's body at the rendering boundary, each segment with its note. */
type Owned = BodySegment & {
	/** 0 for the Lemma note, `n` for the `n`th Reading's. */
	readonly owner: number;
};

export type ReadBundle = {
	readonly data: BundleData;
	/** The stored `lemmaBundle` and the format it sits in, when it reads. */
	readonly stored?: {
		readonly value: z.infer<typeof BundleSchema>;
		readonly format: MetadataFormat;
	};
	readonly lines: readonly string[];
	readonly segments: readonly Owned[];
	/** The Reading key of each Reading part, by owner index minus one. */
	readonly readingKeys: readonly string[];
};

function invalid(message: string): CodecIssue {
	return { _tag: "MissingMetadata", message };
}

/**
 * Reads a bundle: its records from `lemmaBundle` alone, and its body split
 * at the rendering boundary with every note's seals. Never throws.
 */
export function readBundle(content: string): ReadBundle {
	const body = noteMetadataHelper.body(content);
	const lines = linesOf(body);
	// Both formats are read; the preference only orders them.
	const reading = noteMetadataHelper.inspect(
		content,
		LemmaBundleMetadata,
		"Hidden",
	);
	const freeformOnly = (issues: readonly CodecIssue[]): ReadBundle => ({
		data: { issues, ok: false },
		lines,
		readingKeys: [],
		segments: readBody(body, []).map((segment) => ({
			...segment,
			owner: 0,
		})),
	});
	if (reading.kind === "Absent")
		return freeformOnly([
			/^%%tf(?:-part)?:/mu.test(body)
				? {
						_tag: "LegacyMarkerFormat",
						message:
							"The note is in the retired %%tf marker format; the Dictionary reset regenerates it",
					}
				: invalid("The note holds no Lemma bundle"),
		]);
	if (reading.kind === "Invalid")
		return freeformOnly([
			invalid(
				`The note's Lemma bundle is unreadable: ${reading.issue.kind}`,
			),
		]);

	const { lemma, readings } = reading.value;
	const seals: { seal: RenderingSeal; owner: number }[] = [
		...lemma.rendering.map((seal) => ({ owner: 0, seal })),
		...readings.flatMap((part, index) =>
			part.rendering.map((seal) => ({ owner: index + 1, seal })),
		),
	];
	let owner = 0;
	const segments = readBody(
		body,
		seals.map(({ seal }) => seal),
	).map((segment): Owned => {
		if (segment.type === "rendering")
			owner = seals[segment.seal]?.owner ?? owner;
		return { ...segment, owner };
	});

	const issues: CodecIssue[] = [];
	const lemmaData = lemmaNoteDataOf(lemma, { language: "de" });
	if (!lemmaData.ok) issues.push(...lemmaData.issues);
	const parts = readings.map((part) =>
		readingNoteDataOf(part, { language: "de" }),
	);
	const readingKeys: string[] = [];
	const readingEntries: ReadingEntry<"de">[] = [];
	const pendingRelations: PendingSemanticRelationRecord<"de">[] = [];
	parts.forEach((part, index) => {
		if (!part.ok) {
			issues.push(...part.issues);
			return;
		}
		const { readingEntry } = part.data;
		const key = readingKeyOf(readingEntry.reading);
		readingKeys[index] = key;
		if (!lemmaData.ok) return;
		const at = { field: "readings", index };
		if (
			lemmaIdentityKey(readingEntry.reading.lemma) !==
			lemmaIdentityKey(lemmaData.data.lemmaRecord.lemma)
		)
			issues.push({
				_tag: "InconsistentRecord",
				at,
				message: "A Reading of another Lemma",
			});
		else if (
			readingEntries.some(({ reading }) => readingKeyOf(reading) === key)
		)
			issues.push({
				_tag: "InconsistentRecord",
				at,
				message: "Two Reading parts hold one Reading",
			});
		else {
			readingEntries.push(readingEntry);
			pendingRelations.push(...part.data.pendingRelations);
		}
	});
	const data: NoteData | undefined = lemmaData.ok
		? { ...lemmaData.data, pendingRelations, readingEntries }
		: undefined;
	if (
		data !== undefined &&
		data.lemmaRecord.lemma.family === "Foreign" &&
		data.readingEntries.length > 1
	)
		issues.push({
			_tag: "InconsistentRecord",
			at: { field: "readings" },
			message: "A Foreign Lemma has exactly one Reading",
		});
	return {
		data:
			issues.length > 0 || data === undefined
				? { issues, ok: false }
				: {
						data,
						ok: true,
						readingBlockIds: readingBlockIds(
							data.readingEntries.map(({ reading }) => reading),
						),
					},
		lines,
		readingKeys,
		segments,
		stored: { format: reading.format, value: reading.value },
	};
}

/** The freeform a bundle's note holds, as the codec's previous document. */
function previousOf(
	segments: readonly Owned[],
	owners: ReadonlySet<number>,
): PreviousDocument {
	return { segments: segments.filter(({ owner }) => owners.has(owner)) };
}

/**
 * The bundle of `data`: each note serialized by the codec, with the
 * freeform the previous bundle `current` held for it. Freeform of a Reading
 * the data no longer has moves to the Lemma note, so no user text is lost.
 */
function renderBundle(
	current: string | undefined,
	data: NoteData,
	render: BundleRender,
): { readonly body: string; readonly metadata: z.infer<typeof BundleSchema> } {
	const read = current === undefined ? undefined : readBundle(current);
	const ids = readingBlockIds(
		data.readingEntries.map(({ reading }) => reading),
	);
	const options = {
		...render,
		paths: bundlePaths(data.lemmaRecord.lemma, ids),
	};
	const keys = data.readingEntries.map(({ reading }) =>
		readingKeyOf(reading),
	);
	const ownerOf = new Map(
		(read?.readingKeys ?? []).map((key, index) => [key, index + 1]),
	);
	const kept = new Set(keys.flatMap((key) => ownerOf.get(key) ?? []));
	const orphans = new Set(
		[...ownerOf.values()].filter((owner) => !kept.has(owner)),
	);
	const segments = read?.segments ?? [];

	const lemma = serializeLemmaNote(data, {
		...options,
		previous: previousOf(segments, new Set([0, ...orphans])),
	});
	const parts = [lemma.body];
	const readings = data.readingEntries.map(({ reading }, index) => {
		const owner = ownerOf.get(keys[index] ?? "");
		const note = serializeReadingNote(data, reading, {
			...options,
			...(owner === undefined
				? {}
				: { previous: previousOf(segments, new Set([owner])) }),
		});
		const [header = "", ...rest] = note.body.split("\n");
		const marked = `${header} ^${ids.get(keys[index] ?? "")}`;
		const [headerSeal, ...seals] = note.metadata.rendering;
		if (headerSeal?.block !== "header" || headerSeal.lines !== 1)
			throw new Error(
				"A Reading note's body opens with a one-line header",
			);
		parts.push(
			`${SEPARATOR.lines.join("\n")}\n${[marked, ...rest].join("\n")}`,
		);
		return {
			...note.metadata,
			rendering: [
				SEPARATOR_SEAL,
				sealOf({ block: "header", lines: [marked] }),
				...seals,
			],
		};
	});
	return {
		body: parts.filter((part) => part.length > 0).join("\n"),
		metadata: { lemma: lemma.metadata, readings },
	};
}

/** Writes `data` as a bundle over `current`, in `format`, keeping the user's text. */
export function serializeBundle(
	current: string | undefined,
	data: NoteData,
	render: BundleRender,
	format: MetadataFormat,
): string {
	const { body, metadata } = renderBundle(current, data, render);
	const withBody = noteMetadataHelper.mapBody(() => body)(current ?? "");
	return noteMetadataHelper.write(
		LemmaBundleMetadata,
		metadata,
		format,
	)(withBody);
}

/**
 * The `inverse_relation` renderings of a bundle, per Reading part, as one
 * string: equal for two bundles that show the same inverse relations.
 */
export function inverseRelationsShown(content: string): string {
	const read = readBundle(content);
	const shown: Record<string, string[]> = {};
	for (const segment of read.segments) {
		if (
			segment.type !== "rendering" ||
			segment.block !== "inverse_relation"
		)
			continue;
		const key = read.readingKeys[segment.owner - 1] ?? "";
		shown[key] = [...(shown[key] ?? []), ...segment.lines];
	}
	return JSON.stringify(
		Object.keys(shown)
			.sort()
			.map((key) => [key, shown[key]]),
	);
}
