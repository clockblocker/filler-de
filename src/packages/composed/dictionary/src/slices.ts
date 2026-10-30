import {
	type LemmaRecord,
	makeSurfaceId,
	type PendingSemanticRelationRecord,
	type ReadingEntry,
	type StoreRevision,
} from "dumdict";
import {
	derivePendingEntryId,
	derivePendingSemanticRelationLocator,
	reevaluatedPendingEntryIds,
	unitShadowOf,
} from "dumdict/pending";
import type {
	CleanupRelationsSlice,
	LemmaSlice,
	LoadReadingEntryContextRequest,
	OccurrenceSlice,
	OccurrenceSliceRequest,
	ReadingEntryContext,
	ReevaluateShadowsRequest,
	ReevaluateShadowsSlice,
	RekeySurfacesSlice,
	RekeySurfacesSliceRequest,
} from "dumdict/planning";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { lemmaKeyOf, locatorKeyOf, readingKeyOf, shadowKeyOf } from "./keys";
import { type NoteIndex, relationEdgesOf } from "./note-index";

/** The Lemmas and Readings a relation plan starts from and reaches. */
type NeighbourhoodSeeds = {
	readonly sourceReadingKeys?: readonly string[];
	readonly sourceLemmaKeys?: readonly string[];
	readonly targetReadingKeys?: readonly string[];
	readonly targetLemmaKeys?: readonly string[];
	/** Shadows whose Lemmas a pending relation could resolve to. */
	readonly targetShadowKeys?: readonly string[];
};

/** tf-demo's bounds on one relation slice. */
const MAX_NEIGHBOURHOOD_LEMMAS = 100;
const MAX_NEIGHBOURHOOD_READINGS = 200;

/**
 * The closed relation inventory one plan reads, not the whole dictionary
 * (tf-demo's `loadRelationNeighbourhood`). It is bounded at 100 Lemmas and
 * 200 Readings and filled nearest first, in a fixed order: the source
 * Lemmas, the source Readings with their Lemmas and direct Lemma targets,
 * the target Lemmas, every Lemma a seed Shadow names, then breadth first
 * the target Readings and the Readings that Reading targets reach. A
 * Reading whose Lemmas no longer fit is left out, and so is one whose
 * Reading targets were, so every Reading's owner and targets stay in the
 * inventory, as dumdict's slice check needs. It throws when a record the
 * plan names itself does not fit, as tf-demo does, rather than plan
 * without it.
 */
function relationNeighbourhood(
	index: NoteIndex,
	seeds: NeighbourhoodSeeds,
): {
	relationLemmas: LemmaRecord<"de">[];
	relationReadings: ReadingEntry<"de">[];
} {
	const lemmas = new Map<string, LemmaRecord<"de">>();
	const readings = new Map<string, ReadingEntry<"de">>();
	const readingTargets = new Map<string, readonly string[]>();
	const addLemma = (key: string) => {
		if (lemmas.has(key) || lemmas.size >= MAX_NEIGHBOURHOOD_LEMMAS) return;
		const record = index.lemmaData(key)?.lemmaRecord;
		if (record) lemmas.set(key, record);
	};
	/** Adds a Reading with its Lemmas if they fit; returns its Reading targets. */
	const addReading = (key: string): readonly string[] => {
		if (readings.has(key) || readings.size >= MAX_NEIGHBOURHOOD_READINGS)
			return [];
		const entry = index.reading(key);
		if (!entry) return [];
		const edges = relationEdgesOf(entry);
		const needed = [
			...new Set([
				lemmaKeyOf(entry.reading.lemma),
				...edges.flatMap(({ edge, targetLemmaKey }) =>
					edge.target.kind === "lemma" ? [targetLemmaKey] : [],
				),
			]),
		].filter(
			(lemmaKey) => !lemmas.has(lemmaKey) && index.lemmaData(lemmaKey),
		);
		if (lemmas.size + needed.length > MAX_NEIGHBOURHOOD_LEMMAS) return [];
		for (const lemmaKey of needed) addLemma(lemmaKey);
		readings.set(key, entry);
		const targets = edges.flatMap(({ edge }) =>
			edge.target.kind === "reading"
				? [readingKeyOf(edge.target.reading)]
				: [],
		);
		readingTargets.set(key, targets);
		return targets;
	};

	for (const key of seeds.sourceLemmaKeys ?? []) addLemma(key);
	let frontier = (seeds.sourceReadingKeys ?? []).flatMap(addReading);
	for (const key of seeds.targetLemmaKeys ?? []) addLemma(key);
	for (const shadow of seeds.targetShadowKeys ?? [])
		for (const key of index.lemmasNamedBy(shadow)) addLemma(key);
	frontier = [...(seeds.targetReadingKeys ?? []), ...frontier];
	while (frontier.length > 0) frontier = frontier.flatMap(addReading);
	// Drop Readings whose Reading targets did not fit, until none is left open.
	for (let pruned = true; pruned; ) {
		pruned = false;
		for (const [key, targets] of readingTargets)
			if (
				readings.has(key) &&
				// A claim on a Reading no note holds, such as one a removed
				// Lemma had, stays: re-evaluation is what moves it.
				targets.some(
					(target) => !readings.has(target) && index.reading(target),
				)
			) {
				readings.delete(key);
				pruned = true;
			}
	}
	// A plan must see every record it names; only what lies beyond may be cut.
	const seedLemmas = [
		...(seeds.sourceLemmaKeys ?? []),
		...(seeds.targetLemmaKeys ?? []),
		...(seeds.targetShadowKeys ?? []).flatMap((shadow) =>
			index.lemmasNamedBy(shadow),
		),
	];
	const seedReadings = [
		...(seeds.sourceReadingKeys ?? []),
		...(seeds.targetReadingKeys ?? []),
	];
	if (
		seedLemmas.some((key) => index.lemmaData(key) && !lemmas.has(key)) ||
		seedReadings.some((key) => index.reading(key) && !readings.has(key))
	)
		throw new Error(
			`The plan's relation neighbourhood needs more than ${MAX_NEIGHBOURHOOD_LEMMAS} Lemmas or ${MAX_NEIGHBOURHOOD_READINGS} Readings.`,
		);
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
	const existingLemma = index.lemmaData(lemmaKey)?.lemmaRecord;
	const lemmaRead = existingLemma ? { existingLemma } : {};
	const lemmaReadings = (index.lemmaData(lemmaKey)?.readingEntries ?? []).map(
		(entry) => entry.reading,
	);
	/** The stored Shadow relations creating the Reading's Lemma re-evaluates. */
	const matching = index.pendingTargeting(shadowKeyOf(reading.lemma));

	if (request.intent === "applyGeneratedKnowledge") {
		return {
			lemmaReadings,
			...lemmaRead,
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

	if (request.intent === "ensureReadingEntry")
		return {
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
				targetShadowKeys: matching.map(({ pending }) =>
					shadowOf(pending),
				),
			}),
		};

	if (
		request.intent === "ensureOwnedSurface" ||
		request.intent === "recordOccurrence"
	) {
		const surface = index.surface(makeSurfaceId("de", request.surface));
		const existingOwnedSurfaces = surface ? [surface] : [];
		if (request.intent === "ensureOwnedSurface")
			return {
				existingOwnedSurfaces,
				intent: request.intent,
				revision,
				...lemmaRead,
				...reads,
			};
		return {
			attestationLinksWithRefs: index.linksWithRef(request.ref),
			existingOwnedSurfaces,
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
	return {
		attestationLinksWithRefs: [...new Set(request.attestationRefs)].flatMap(
			(ref) => index.linksWithRef(ref),
		),
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
		lemmaReadings,
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

/**
 * The slice `reevaluateShadows` plans from: every stored Shadow relation on
 * a removed Lemma's Shadow, every stored Reading that claims a removed Lemma
 * or one of its Readings, and their neighbourhood, which holds the Lemmas
 * those Shadows name.
 */
export function loadReevaluateShadowsContext(
	index: NoteIndex,
	revision: StoreRevision,
	request: Omit<ReevaluateShadowsRequest<"de">, "baseRevision">,
): ReevaluateShadowsSlice<"de"> {
	const ids = new Set<string>(reevaluatedPendingEntryIds(request));
	const removed = request.removedLemmas ?? [];
	const shadowKeys = [...new Set(removed.map(unitShadowOf).map(shadowKeyOf))];
	const pendingRelations = shadowKeys
		.flatMap((key) => index.pendingTargeting(key))
		.filter(({ locator }) => ids.has(locator.targetPendingId));
	const claimants = removed.flatMap((lemma) =>
		index
			.edgesTo(lemmaKeyOf(lemma))
			.map(({ source }) => readingKeyOf(source)),
	);
	return {
		pendingRelations,
		revision,
		...relationNeighbourhood(index, {
			sourceReadingKeys: [
				...new Set([
					...pendingRelations.map(({ sourceReading }) =>
						readingKeyOf(sourceReading),
					),
					...claimants,
				]),
			],
			targetShadowKeys: shadowKeys,
		}),
	};
}

/**
 * The slice `removeOccurrence` and `reconcileAttestationLinks` plan from:
 * each stored Lemma one of whose Readings holds a link with a requested
 * ref, whole, every other Reading that claims one of them or one of their
 * Readings, and every stored Shadow relation whose Pending Entry ID is one
 * of theirs.
 */
export function loadOccurrenceSlice(
	index: NoteIndex,
	revision: StoreRevision,
	request: OccurrenceSliceRequest,
): OccurrenceSlice<"de"> {
	const lemmaKeys = new Set<string>();
	for (const ref of new Set(request.refs))
		for (const link of index.linksWithRef(ref)) {
			const owner = index.readingOwner(readingKeyOf(link.reading));
			if (owner !== undefined) lemmaKeys.add(owner);
		}
	const lemmas: LemmaSlice<"de">[] = [...lemmaKeys].sort().flatMap((key) => {
		const data = index.lemmaData(key);
		return data
			? [
					{
						lemmaRecord: data.lemmaRecord,
						ownedSurfaceEntries: [...data.ownedSurfaceEntries],
						pendingRelations: [...data.pendingRelations],
						readingEntries: [...data.readingEntries],
					},
				]
			: [];
	});
	const claimingReadings = new Map<string, ReadingEntry<"de">>();
	for (const key of lemmaKeys)
		for (const { source } of index.edgesTo(key)) {
			const sourceKey = readingKeyOf(source);
			if (lemmaKeys.has(lemmaKeyOf(source.lemma))) continue;
			const entry = index.reading(sourceKey);
			if (entry) claimingReadings.set(sourceKey, entry);
		}
	const pendingRelationsMatchingLemmas = lemmas.flatMap(({ lemmaRecord }) => {
		const id = derivePendingEntryId(unitShadowOf(lemmaRecord.lemma));
		return index
			.pendingTargeting(shadowKeyOf(lemmaRecord.lemma))
			.filter(({ locator }) => locator.targetPendingId === id);
	});
	return {
		claimingReadings: [...claimingReadings.values()],
		lemmas,
		pendingRelationsMatchingLemmas: [
			...new Map(
				pendingRelationsMatchingLemmas.map((record) => [
					locatorKeyOf(record.locator),
					record,
				]),
			).values(),
		],
		revision,
	};
}

/**
 * The slice `rekeySurfaces` plans from: each stored Surface Entry with a
 * requested id, without its Surface, and every Reading whose links name one.
 */
export function loadRekeySurfacesSlice(
	index: NoteIndex,
	revision: StoreRevision,
	request: RekeySurfacesSliceRequest<"de">,
): RekeySurfacesSlice<"de"> {
	const ids = [...new Set<string>(request.surfaceIds)];
	const readings = new Map<string, ReadingEntry<"de">>();
	for (const id of ids)
		for (const entry of index.readingsLinking(id))
			readings.set(readingKeyOf(entry.reading), entry);
	return {
		readings: [...readings.values()],
		revision,
		surfaces: ids.flatMap((id) => {
			const entry = index.surface(id);
			return entry
				? [
						{
							attestations: entry.attestations,
							attestedTranslations: entry.attestedTranslations,
							id: entry.id,
							notes: entry.notes,
							ownerLemma: entry.ownerLemma,
						},
					]
				: [];
		}),
	};
}
