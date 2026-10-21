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
import { lemmaIdentityKey, readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { blockIdsOf, type NoteBlockIds } from "./block-ids";
import {
	allowedIn,
	KNOWLEDGE_BLOCKS,
	type SerializedBlockKind,
	type TypedBlockKind,
} from "./blocks";
import type { LemmaNoteDocument, NoteBlock, NotePart } from "./document";
import type { CodecIssue, IssueLocation, RecordName } from "./issues";
import type {
	CodecOptions,
	LemmaNoteData,
	PartialLemmaNoteData,
	SurfaceId,
} from "./types";

export type LemmaNoteDataResult<L extends Dumling.Language> =
	| {
			readonly ok: true;
			readonly data: LemmaNoteData<L>;
			readonly blockIds: NoteBlockIds;
	  }
	| {
			readonly ok: false;
			readonly issues: readonly [CodecIssue, ...CodecIssue[]];
			readonly partial: PartialLemmaNoteData<L>;
	  };

type TypedBlock = Extract<NoteBlock, { type: "serialized" | "projection" }>;
type Payloads = Partial<Record<SerializedBlockKind, unknown>>;

/**
 * Reconstructs and validates a note's dumdict records from its document
 * (spec: documentToData). Every problem is returned as a {@link CodecIssue};
 * it never throws on a hand-edited note. Projection Blocks, the header and
 * Block IDs never define data: the `identity` Block is the only source of
 * the Lemma.
 */
export function documentToData<L extends Dumling.Language>(
	document: LemmaNoteDocument,
	{ language }: CodecOptions<L>,
): LemmaNoteDataResult<L> {
	const issues: CodecIssue[] = [];
	const report = (issue: CodecIssue) => {
		issues.push(issue);
	};

	for (const block of document.preamble) {
		if (block.type === "serialized" || block.type === "projection")
			report({
				_tag: "MisplacedBlock",
				at: { scope: "preamble" },
				kind: block.kind,
				message: `The ${block.kind} Block sits before the first part`,
			});
	}

	const located = document.parts.map((part, partIndex) => ({
		at: { partIndex, scope: part.scope } as const,
		part,
		payloads: readPayloads(part, { partIndex, scope: part.scope }, report),
	}));

	const lemmaParts = located.filter(({ part }) => part.scope === "lemma");
	for (const extra of lemmaParts.slice(1)) {
		report({
			_tag: "DuplicatePart",
			at: extra.at,
			message: "A note holds exactly one Lemma part",
			scope: "lemma",
		});
	}
	const lemmaRecord = readLemmaRecord(lemmaParts[0], language, report);
	const lemma = lemmaRecord?.lemma;

	const readingEntries: ReadingEntry<L>[] = [];
	const pendingRelations: PendingSemanticRelationRecord<L>[] = [];
	const ownedSurfaceEntries: SurfaceEntry<L>[] = [];
	const readingParts: { at: IssueLocation; part: NotePart; key: string }[] =
		[];
	const surfaceParts: { at: IssueLocation; part: NotePart; key: string }[] =
		[];

	const readingLocations = located.filter(
		({ part }) => part.scope === "reading",
	);
	if (lemma !== undefined && lemma.family === "Foreign") {
		for (const extra of readingLocations.slice(1)) {
			report({
				_tag: "InconsistentRecord",
				at: extra.at,
				message: "A Foreign Lemma has exactly one Reading",
			});
		}
	}
	for (const { at, part, payloads } of readingLocations) {
		if (lemma === undefined) continue;
		const entry = readReadingEntry(lemma, payloads, at, language, report);
		if (entry === undefined) continue;
		const key = readingIdentityKey(entry.reading);
		if (readingParts.some((seen) => seen.key === key)) {
			report({
				_tag: "InconsistentRecord",
				at,
				message: "Two Reading parts hold the same Reading",
			});
			continue;
		}
		readingParts.push({ at, key, part });
		readingEntries.push(entry);
		pendingRelations.push(
			...readPendingRelations(entry, payloads, at, language, report),
		);
	}

	for (const { at, part, payloads } of located) {
		if (part.scope !== "surface" || lemma === undefined) continue;
		const entry = readSurfaceEntry(lemma, payloads, at, language, report);
		if (entry === undefined) continue;
		if (surfaceParts.some((seen) => seen.key === entry.id)) {
			report({
				_tag: "InconsistentRecord",
				at,
				message: "Two Surface parts hold the same Surface",
			});
			continue;
		}
		surfaceParts.push({ at, key: entry.id, part });
		ownedSurfaceEntries.push(entry);
	}

	const blockIds = blockIdsOf({ ownedSurfaceEntries, readingEntries });
	const checkId = (
		{ at, part }: { at: IssueLocation; part: NotePart },
		expected: string | undefined,
	) => {
		if (expected === undefined || part.blockId === expected) return;
		report({
			_tag: "BlockIdMismatch",
			at,
			expected,
			found: part.blockId,
			message: `The part's Block ID should be ${expected}`,
		});
	};
	for (const seen of readingParts)
		checkId(seen, blockIds.readings.get(seen.key));
	for (const seen of surfaceParts)
		checkId(seen, blockIds.surfaces.get(seen.key as SurfaceId));

	const [first, ...rest] = issues;
	if (first !== undefined || lemmaRecord === undefined)
		return {
			issues: first === undefined ? missingIdentity() : [first, ...rest],
			ok: false,
			partial: {
				lemmaRecord,
				ownedSurfaceEntries,
				pendingRelations,
				readingEntries,
			},
		};
	return {
		blockIds,
		data: {
			lemmaRecord,
			ownedSurfaceEntries,
			pendingRelations,
			readingEntries,
		},
		ok: true,
	};
}

function missingIdentity(): [CodecIssue] {
	return [
		{
			_tag: "MissingRequiredBlock",
			at: { scope: "note" },
			kind: "identity",
			message: "The note has no identity Block",
		},
	];
}

/**
 * Reads the JSON payload of each serialized Block of a part, reporting
 * misplaced, repeated and unparseable Blocks. Projection Blocks are only
 * checked for placement and repetition; their content is never read.
 */
function readPayloads(
	part: NotePart,
	at: IssueLocation,
	report: (issue: CodecIssue) => void,
): Payloads {
	const payloads: Payloads = {};
	const seen = new Set<TypedBlockKind>();
	for (const block of part.blocks) {
		if (block.type !== "serialized" && block.type !== "projection")
			continue;
		if (!allowedIn(part.scope, block.kind)) {
			report({
				_tag: "MisplacedBlock",
				at,
				kind: block.kind,
				message: `A ${part.scope} part holds no ${block.kind} Block`,
			});
			continue;
		}
		if (seen.has(block.kind)) {
			report({
				_tag: "DuplicateBlock",
				at,
				kind: block.kind,
				message: `The ${block.kind} Block occurs more than once`,
			});
			continue;
		}
		seen.add(block.kind);
		if (block.type === "serialized") {
			const value = parsePayload(block, at, report);
			if (value !== undefined) payloads[block.kind] = value.json;
		}
	}
	return payloads;
}

function parsePayload(
	block: TypedBlock & { type: "serialized" },
	at: IssueLocation,
	report: (issue: CodecIssue) => void,
): { json: unknown } | undefined {
	try {
		return { json: JSON.parse(block.payload) as unknown };
	} catch (error) {
		report({
			_tag: "InvalidBlockPayload",
			at,
			kind: block.kind,
			message: `The ${block.kind} payload is not JSON: ${String(error)}`,
		});
		return undefined;
	}
}

/** Runs a dumdict parser, turning its error, or a throw, into an issue. */
function validated<T>(
	record: RecordName,
	at: IssueLocation,
	report: (issue: CodecIssue) => void,
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

function readLemmaRecord<L extends Dumling.Language>(
	located:
		| { at: IssueLocation; part: NotePart; payloads: Payloads }
		| undefined,
	language: L,
	report: (issue: CodecIssue) => void,
): LemmaRecord<L> | undefined {
	if (located === undefined) {
		report(missingIdentity()[0]);
		return undefined;
	}
	const { at, part, payloads } = located;
	if (!("identity" in payloads)) {
		const present = part.blocks.some(
			(block) => block.type === "serialized" && block.kind === "identity",
		);
		// An identity Block whose payload failed to parse is already reported.
		if (!present)
			report({
				_tag: "MissingRequiredBlock",
				at,
				kind: "identity",
				message: "The Lemma part has no identity Block",
			});
		return undefined;
	}
	return validated("LemmaRecord", at, report, () =>
		parseAsLemmaRecord({ lemma: payloads.identity }, language),
	);
}

function readReadingEntry<L extends Dumling.Language>(
	lemma: Dumling.Lemma<L>,
	payloads: Payloads,
	at: IssueLocation,
	language: L,
	report: (issue: CodecIssue) => void,
): ReadingEntry<L> | undefined {
	const foreign = lemma.family === "Foreign";
	if (foreign && "reading" in payloads) {
		report({
			_tag: "InconsistentRecord",
			at,
			message: "A Foreign Reading has no Emoji Description",
		});
		return undefined;
	}
	if (!(foreign || "reading" in payloads)) {
		report({
			_tag: "MissingRequiredBlock",
			at,
			kind: "reading",
			message: "The Reading part has no reading Block",
		});
		return undefined;
	}
	const knowledge: Record<string, unknown> = {};
	for (const [kind, aspect] of Object.entries(KNOWLEDGE_BLOCKS)) {
		const value = payloads[kind as keyof typeof KNOWLEDGE_BLOCKS];
		if (value !== undefined) knowledge[aspect] = value;
	}
	const entry = {
		attestationLinks: orDefault(payloads, "attestation", []),
		attestedTranslations: orDefault(payloads, "attested_translation", []),
		notes: orDefault(payloads, "notes", ""),
		reading: foreign
			? { lemma, unitKind: "Reading" }
			: {
					emojiDescription: payloads.reading,
					lemma,
					unitKind: "Reading",
				},
		...(Object.keys(knowledge).length > 0 ? { knowledge } : {}),
	};
	return validated("ReadingEntry", at, report, () =>
		parseAsReadingEntry(entry, language),
	);
}

function readPendingRelations<L extends Dumling.Language>(
	entry: ReadingEntry<L>,
	payloads: Payloads,
	at: IssueLocation,
	language: L,
	report: (issue: CodecIssue) => void,
): PendingSemanticRelationRecord<L>[] {
	const payload = payloads.pending_relation;
	if (payload === undefined) return [];
	if (!Array.isArray(payload)) {
		report({
			_tag: "InvalidBlockPayload",
			at,
			kind: "pending_relation",
			message: "The pending_relation payload is not a list",
		});
		return [];
	}
	const records: PendingSemanticRelationRecord<L>[] = [];
	for (const item of payload) {
		const { resolvedLemma, ...pending } = (
			typeof item === "object" && item !== null ? item : {}
		) as Record<string, unknown>;
		const record = validated(
			"PendingSemanticRelationRecord",
			at,
			report,
			() =>
				parseAsPendingSemanticRelationRecord(
					{
						...createPendingSemanticRelationRecord(
							entry.reading,
							// dumdict validates the reconstructed record below.
							pending as Parameters<
								typeof createPendingSemanticRelationRecord<L>
							>[1],
						),
						...(resolvedLemma === undefined
							? {}
							: { resolvedLemma }),
					},
					language,
				),
		);
		if (record !== undefined) records.push(record);
	}
	return records;
}

function readSurfaceEntry<L extends Dumling.Language>(
	lemma: Dumling.Lemma<L>,
	payloads: Payloads,
	at: IssueLocation,
	language: L,
	report: (issue: CodecIssue) => void,
): SurfaceEntry<L> | undefined {
	if (!("surface" in payloads)) {
		report({
			_tag: "MissingRequiredBlock",
			at,
			kind: "surface",
			message: "The Surface part has no surface Block",
		});
		return undefined;
	}
	const entry = validated("SurfaceEntry", at, report, () =>
		parseAsSurfaceEntry(
			{
				attestations: orDefault(payloads, "attestation", []),
				attestedTranslations: orDefault(
					payloads,
					"attested_translation",
					[],
				),
				id: makeSurfaceId(
					language,
					payloads.surface as Dumling.Surface<L>,
				),
				notes: orDefault(payloads, "notes", ""),
				ownerLemma: lemma,
				surface: payloads.surface,
			},
			language,
		),
	);
	if (entry === undefined) return undefined;
	if (lemmaIdentityKey(entry.surface.lemma) !== lemmaIdentityKey(lemma)) {
		report({
			_tag: "InconsistentRecord",
			at,
			message:
				"An owned Surface realizes a different Lemma than the note's",
		});
		return undefined;
	}
	return entry;
}

/**
 * A Block's payload, or the value its absence stands for. A present payload,
 * `null` included, is passed on as written, so dumdict rejects it rather
 * than parse repairing it.
 */
function orDefault(
	payloads: Payloads,
	kind: SerializedBlockKind,
	absent: unknown,
): unknown {
	return kind in payloads ? payloads[kind] : absent;
}
