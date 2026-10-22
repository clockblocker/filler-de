import type {
	AttestationLink,
	PendingSemanticRelationRecord,
	ReadingEntry,
	StoreRevision,
	SurfaceEntry,
} from "dumdict";
import type {
	CleanupRelationsSlice,
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
import { Result } from "effect";
import { DictionaryRequestError } from "./errors";
import { formKeyOf, lemmaKeyOf, readingKeyOf } from "./keys";
import type { NoteIndex, ReadingLocation, RelationEdge } from "./note-index";
import {
	loadCleanupRelationsContext,
	loadOccurrenceSlice,
	loadReadingEntryContext,
	loadReevaluateShadowsContext,
	loadRekeySurfacesSlice,
} from "./slices";

/** A stored Lemma dumgen may name a unit by, and the texts it was found under. */
export type LemmaCandidate = {
	readonly lemma: Dumling.Lemma<"de">;
	readonly foundUnder: readonly string[];
};

/** A stored Lemma's note path and records, with its Paradigm. */
export type StoredLemmaNote = {
	readonly path: string;
	readonly paradigm?: Dumrel.LemmaParadigm;
	readonly readings: readonly ReadingEntry<"de">[];
	readonly ownedSurfaces: readonly SurfaceEntry<"de">[];
	readonly pendingRelations: readonly PendingSemanticRelationRecord<"de">[];
};

/**
 * The dictionary as one published index version holds it, at one revision.
 * Every read is synchronous, so a plan built from a view inside
 * `transact` cannot wait on anything while it holds the store's lock.
 */
export type DictionaryView = {
	readonly revision: StoreRevision;
	/** dumdict's Reading Entry slice for one planner request. */
	readonly loadReadingEntryContext: (
		request: LoadReadingEntryContextRequest<"de">,
	) => Result.Result<ReadingEntryContext<"de">, DictionaryRequestError>;
	/** dumdict's `cleanupRelations` slice. */
	readonly loadCleanupRelationsContext: (request: {
		readonly resolutions: readonly {
			readonly locator: PendingSemanticRelationRecord<"de">["locator"];
		}[];
	}) => CleanupRelationsSlice<"de">;
	/** dumdict's `reevaluateShadows` slice. */
	readonly loadReevaluateShadowsContext: (
		request: Omit<ReevaluateShadowsRequest<"de">, "baseRevision">,
	) => Result.Result<ReevaluateShadowsSlice<"de">, DictionaryRequestError>;
	/** dumdict's `removeOccurrence` and `reconcileAttestationLinks` slice. */
	readonly loadOccurrenceSlice: (
		request: OccurrenceSliceRequest,
	) => OccurrenceSlice<"de">;
	/** dumdict's `rekeySurfaces` slice. */
	readonly loadRekeySurfacesSlice: (
		request: RekeySurfacesSliceRequest<"de">,
	) => RekeySurfacesSlice<"de">;
	/** Stored Lemmas whose Canonical Form or owned Surface is one of these texts. */
	readonly lemmaCandidates: (texts: readonly string[]) => LemmaCandidate[];
	/** A Lemma's note path and records, with its Paradigm, if it is stored. */
	readonly lemmaNote: (
		lemma: Dumling.Lemma<"de">,
	) => StoredLemmaNote | undefined;
	/** Every stored Lemma and the path of its Lemma note, by path. */
	readonly lemmaNotes: () => readonly {
		readonly path: string;
		readonly lemma: Dumling.Lemma<"de">;
	}[];
	/**
	 * Every stored Attestation Link whose ref starts with `prefix`, such as
	 * the refs into one Scroll.
	 */
	readonly attestationLinksWithRefPrefix: (
		prefix: string,
	) => readonly AttestationLink<"de">[];
	/** Where a Reading lives: its Reading note and its Lemma note. */
	readonly readingLocation: (
		reading: Dumling.Reading<"de">,
	) => ReadingLocation | undefined;
	readonly surface: (
		surfaceId: SurfaceEntry<"de">["id"],
	) => SurfaceEntry<"de"> | undefined;
	/** Stored relations whose target is this Lemma or one of its Readings. */
	readonly relationEdgesTo: (lemma: Dumling.Lemma<"de">) => RelationEdge[];
};

const message = (cause: unknown): string =>
	cause instanceof Error ? cause.message : String(cause);

/** A slice that throws when the request does not fit, as a typed failure. */
function attempted<A>(load: () => A): Result.Result<A, DictionaryRequestError> {
	try {
		return Result.succeed(load());
	} catch (cause) {
		return Result.fail(
			new DictionaryRequestError({ cause, message: message(cause) }),
		);
	}
}

/** Reads over one index version, never another. */
export function viewOf(
	index: NoteIndex,
	revision: StoreRevision,
): DictionaryView {
	return {
		attestationLinksWithRefPrefix: (prefix) =>
			index.linksWithRefPrefix(prefix),
		lemmaCandidates: (texts) => {
			const found = new Map<
				string,
				{ lemma: Dumling.Lemma<"de">; foundUnder: string[] }
			>();
			for (const text of texts)
				for (const key of index.lemmasWithForm(formKeyOf(text, "de"))) {
					const lemma = index.lemmaData(key)?.lemmaRecord.lemma;
					if (!lemma) continue;
					const candidate = found.get(key) ?? {
						foundUnder: [],
						lemma,
					};
					if (!candidate.foundUnder.includes(text))
						candidate.foundUnder.push(text);
					found.set(key, candidate);
				}
			return [...found.values()];
		},
		lemmaNote: (lemma) => {
			const note = index.lemmaNote(lemmaKeyOf(lemma));
			const paradigm = note?.data.lemmaRecord.paradigm;
			return note
				? {
						ownedSurfaces: note.data.ownedSurfaceEntries,
						...(paradigm === undefined ? {} : { paradigm }),
						path: note.path,
						pendingRelations: note.data.pendingRelations,
						readings: note.data.readingEntries,
					}
				: undefined;
		},
		lemmaNotes: () =>
			index.lemmaNotes().map(({ data, path }) => ({
				lemma: data.lemmaRecord.lemma,
				path,
			})),
		loadCleanupRelationsContext: (request) =>
			loadCleanupRelationsContext(index, revision, request),
		loadOccurrenceSlice: (request) =>
			loadOccurrenceSlice(index, revision, request),
		loadReadingEntryContext: (request) =>
			attempted(() => loadReadingEntryContext(index, revision, request)),
		loadReevaluateShadowsContext: (request) =>
			attempted(() =>
				loadReevaluateShadowsContext(index, revision, request),
			),
		loadRekeySurfacesSlice: (request) =>
			loadRekeySurfacesSlice(index, revision, request),
		readingLocation: (reading) =>
			index.readingLocation(readingKeyOf(reading)),
		relationEdgesTo: (lemma) => index.edgesTo(lemmaKeyOf(lemma)),
		revision,
		surface: (surfaceId) => index.surface(surfaceId),
	};
}
