import {
	type LemmaRecord,
	makeSurfaceId,
	type PendingSemanticRelationRecord,
	type ReadingEntry,
	type StoreRevision,
} from "dumdict";
import { derivePendingSemanticRelationLocator } from "dumdict/pending";
import type {
	CleanupRelationsSlice,
	LoadReadingEntryContextRequest,
	ReadingEntryContext,
} from "dumdict/planning";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { lemmaKeyOf, locatorKeyOf, readingKeyOf, shadowKeyOf } from "./keys";
import { type NoteIndex, relationEdgesOf } from "./note-index";

/** The Lemmas and Readings a relation plan starts from and reaches. */
export type NeighbourhoodSeeds = {
	readonly sourceReadingKeys?: readonly string[];
	readonly sourceLemmaKeys?: readonly string[];
	readonly targetReadingKeys?: readonly string[];
	readonly targetLemmaKeys?: readonly string[];
	/** Shadows whose Lemmas a pending relation could resolve to. */
	readonly targetShadowKeys?: readonly string[];
};

/**
 * The closed relation inventory one plan reads, not the whole dictionary
 * (tf-demo's `loadRelationNeighbourhood`): the seed Readings and Lemmas,
 * every Lemma a seed Shadow names, and each loaded Reading's Lemma and
 * direct targets, following Reading targets to their Readings. Every
 * Reading's owner and targets are in it, as dumdict's slice check needs.
 */
export function relationNeighbourhood(
	index: NoteIndex,
	seeds: NeighbourhoodSeeds,
): {
	relationLemmas: LemmaRecord<"de">[];
	relationReadings: ReadingEntry<"de">[];
} {
	const lemmas = new Map<string, LemmaRecord<"de">>();
	const readings = new Map<string, ReadingEntry<"de">>();
	const addLemma = (key: string) => {
		if (lemmas.has(key)) return;
		const record = index.lemmaData(key)?.lemmaRecord;
		if (record) lemmas.set(key, record);
	};
	for (const key of seeds.sourceLemmaKeys ?? []) addLemma(key);
	for (const key of seeds.targetLemmaKeys ?? []) addLemma(key);
	for (const shadow of seeds.targetShadowKeys ?? [])
		for (const key of index.lemmasNamedBy(shadow)) addLemma(key);

	let frontier = [
		...(seeds.sourceReadingKeys ?? []),
		...(seeds.targetReadingKeys ?? []),
	];
	while (frontier.length > 0) {
		const next: string[] = [];
		for (const key of frontier) {
			if (readings.has(key)) continue;
			const entry = index.reading(key);
			if (!entry) continue;
			readings.set(key, entry);
			addLemma(lemmaKeyOf(entry.reading.lemma));
			for (const { edge, targetLemmaKey } of relationEdgesOf(entry)) {
				if (edge.target.kind === "reading")
					next.push(readingKeyOf(edge.target.reading));
				else addLemma(targetLemmaKey);
			}
		}
		frontier = next;
	}
	return {
		relationLemmas: [...lemmas.values()],
		relationReadings: [...readings.values()],
	};
}

const shadowOf = (pending: { readonly target: Dumrel.UnitShadow }): string =>
	shadowKeyOf(pending.target);

function exactPending(
	index: NoteIndex,
	reading: Dumling.Reading<"de">,
	pending: readonly Parameters<
		typeof derivePendingSemanticRelationLocator<"de">
	>[1][],
): PendingSemanticRelationRecord<"de">[] {
	const keys = new Set(
		pending.map((value) =>
			locatorKeyOf(derivePendingSemanticRelationLocator(reading, value)),
		),
	);
	return [...keys].flatMap((key) => {
		const record = index.pendingRecord(key);
		return record ? [record] : [];
	});
}

/** The slice dumdict's planner asks for one Reading Entry request. */
export function loadReadingEntryContext(
	index: NoteIndex,
	revision: StoreRevision,
	request: LoadReadingEntryContextRequest<"de">,
): ReadingEntryContext<"de"> {
	const { reading } = request;
	const readingKey = readingKeyOf(reading);
	const lemmaKey = lemmaKeyOf(reading.lemma);
	const existingReading = index.reading(readingKey);
	const reads = existingReading ? { existingReading } : {};

	if (request.intent === "applyGeneratedKnowledge") {
		return {
			exactPendingRelations: exactPending(
				index,
				reading,
				request.pendingRelations,
			),
			intent: request.intent,
			revision,
			...reads,
			...relationNeighbourhood(index, {
				sourceReadingKeys: [readingKey],
				targetLemmaKeys: request.relationTargetLemmas.map(lemmaKeyOf),
				targetReadingKeys:
					request.relationTargetReadings.map(readingKeyOf),
				targetShadowKeys: request.pendingRelations.map(shadowOf),
			}),
		};
	}

	const existingLemma = index.lemmaData(lemmaKey)?.lemmaRecord;
	const lemmaRead = existingLemma ? { existingLemma } : {};
	if (request.intent === "ensureReadingEntry")
		return { intent: request.intent, revision, ...lemmaRead, ...reads };

	if (request.intent === "ensureOwnedSurface") {
		const surface = index.surface(makeSurfaceId("de", request.surface));
		return {
			existingOwnedSurfaces: surface ? [surface] : [],
			intent: request.intent,
			revision,
			...lemmaRead,
			...reads,
		};
	}

	const surfaceIds = [
		...new Set(
			request.ownedSurfaces.map((surface) =>
				makeSurfaceId("de", surface),
			),
		),
	];
	const explicitLemmaKeys = [
		...new Set(
			request.relations.flatMap(({ target }) =>
				target.kind === "existing" ? [lemmaKeyOf(target.lemma)] : [],
			),
		),
	];
	const proposedPending = request.relations.flatMap(({ target }) =>
		target.kind === "pending" ? [target.pending] : [],
	);
	const matching = index.pendingTargeting(shadowKeyOf(reading.lemma));
	return {
		exactPendingRelations: exactPending(index, reading, proposedPending),
		existingOwnedSurfaces: surfaceIds.flatMap((id) => {
			const entry = index.surface(id);
			return entry ? [entry] : [];
		}),
		explicitExistingLemmaTargets: explicitLemmaKeys.flatMap((key) => {
			const record = index.lemmaData(key)?.lemmaRecord;
			return record ? [record] : [];
		}),
		intent: request.intent,
		pendingRelationsMatchingProposedLemma: matching,
		revision,
		...lemmaRead,
		...reads,
		...relationNeighbourhood(index, {
			sourceLemmaKeys: [lemmaKey],
			sourceReadingKeys: matching.map(({ sourceReading }) =>
				readingKeyOf(sourceReading),
			),
			targetLemmaKeys: explicitLemmaKeys,
			targetShadowKeys: [
				...proposedPending.map(shadowOf),
				...matching.map(({ pending }) => shadowOf(pending)),
			],
		}),
	};
}

/** The slice `cleanupRelations` plans from: the named records and their neighbourhood. */
export function loadCleanupRelationsContext(
	index: NoteIndex,
	revision: StoreRevision,
	request: {
		readonly resolutions: readonly {
			readonly locator: Parameters<typeof locatorKeyOf>[0];
		}[];
	},
): CleanupRelationsSlice<"de"> {
	const keys = new Set(
		request.resolutions.map(({ locator }) => locatorKeyOf(locator)),
	);
	const pendingRelations = [...keys].flatMap((key) => {
		const record = index.pendingRecord(key);
		return record ? [record] : [];
	});
	return {
		pendingRelations,
		revision,
		...relationNeighbourhood(index, {
			sourceReadingKeys: pendingRelations.map(({ sourceReading }) =>
				readingKeyOf(sourceReading),
			),
			targetShadowKeys: pendingRelations.map(({ pending }) =>
				shadowOf(pending),
			),
		}),
	};
}
