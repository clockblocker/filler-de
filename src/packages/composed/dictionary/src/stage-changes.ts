import type {
	ChangePrecondition,
	PendingSemanticRelationRecord,
	PlannedChangeOp,
	ReadingEntry,
	StoreRevision,
	SurfaceEntry,
} from "dumdict";
import {
	applyDumdictKnowledgeChanges,
	impliedChangePreconditions,
} from "dumdict/planning";
import type * as Dumling from "dumling/types";
import { lemmaKeyOf, locatorKeyOf, readingKeyOf } from "./keys";
import type { NoteData } from "./note-entry";
import type { NoteIndex } from "./note-index";

/** One note's records as a commit stages them. */
export type StagedNote = {
	readonly lemmaKey: string;
	/** The path of the note the index holds it in; absent for a new Lemma. */
	readonly basePath: string | undefined;
	readonly base: NoteData | undefined;
	data: {
		lemmaRecord: NoteData["lemmaRecord"];
		readingEntries: ReadingEntry<"de">[];
		ownedSurfaceEntries: SurfaceEntry<"de">[];
		pendingRelations: PendingSemanticRelationRecord<"de">[];
	};
};

export type StagedChanges =
	| { readonly _tag: "Staged"; readonly notes: readonly StagedNote[] }
	| { readonly _tag: "PreconditionFailed"; readonly changeIndex: number };

/**
 * A copy-on-write fork of the index: the notes a commit touched, staged
 * over the index it read. Reads see staged notes first, so each change's
 * preconditions are checked against the changes before it.
 */
class StagedView {
	readonly notes = new Map<string, StagedNote>();

	constructor(
		private readonly index: NoteIndex,
		private readonly revision: StoreRevision,
	) {}

	data(lemmaKey: string): StagedNote["data"] | NoteData | undefined {
		return this.notes.get(lemmaKey)?.data ?? this.index.lemmaData(lemmaKey);
	}

	/** The staged note of a stored Lemma, copied from the index on first touch. */
	stage(lemmaKey: string): StagedNote | undefined {
		const staged = this.notes.get(lemmaKey);
		if (staged) return staged;
		const note = this.index.lemmaNote(lemmaKey);
		if (!note) return undefined;
		const next: StagedNote = {
			base: note.data,
			basePath: note.path,
			data: {
				lemmaRecord: note.data.lemmaRecord,
				ownedSurfaceEntries: [...note.data.ownedSurfaceEntries],
				pendingRelations: [...note.data.pendingRelations],
				readingEntries: [...note.data.readingEntries],
			},
			lemmaKey,
		};
		this.notes.set(lemmaKey, next);
		return next;
	}

	create(record: NoteData["lemmaRecord"]): void {
		const lemmaKey = lemmaKeyOf(record.lemma);
		this.notes.set(lemmaKey, {
			base: undefined,
			basePath: undefined,
			data: {
				lemmaRecord: record,
				ownedSurfaceEntries: [],
				pendingRelations: [],
				readingEntries: [],
			},
			lemmaKey,
		});
	}

	readingEntry(
		reading: Dumling.Reading<"de">,
	): ReadingEntry<"de"> | undefined {
		const key = readingKeyOf(reading);
		return this.data(lemmaKeyOf(reading.lemma))?.readingEntries.find(
			(entry) => readingKeyOf(entry.reading) === key,
		);
	}

	hasSurface(surfaceId: string): boolean {
		for (const note of this.notes.values())
			if (
				note.data.ownedSurfaceEntries.some(({ id }) => id === surfaceId)
			)
				return true;
		const owner = this.index.surfaceOwner(surfaceId);
		return owner !== undefined && !this.notes.has(owner);
	}

	hasPending(record: PendingSemanticRelationRecord<"de">): boolean {
		const key = locatorKeyOf(record.locator);
		return (
			this.data(
				lemmaKeyOf(record.sourceReading.lemma),
			)?.pendingRelations.some(
				(stored) => locatorKeyOf(stored.locator) === key,
			) ?? false
		);
	}

	fails(precondition: ChangePrecondition<"de">): boolean {
		switch (precondition.kind) {
			case "revisionMatches":
				return precondition.revision !== this.revision;
			case "lemmaExists":
				return !this.data(lemmaKeyOf(precondition.lemma));
			case "lemmaMissing":
				return Boolean(this.data(lemmaKeyOf(precondition.lemma)));
			case "readingExists":
				return !this.readingEntry(precondition.reading);
			case "readingMissing":
				return Boolean(this.readingEntry(precondition.reading));
			case "surfaceExists":
				return !this.hasSurface(precondition.surfaceId);
			case "surfaceMissing":
				return this.hasSurface(precondition.surfaceId);
			case "pendingRelationExists":
				return !this.hasPending(precondition.record);
			case "pendingRelationMissing":
				return this.hasPending(precondition.record);
			case "readingAttestationMissing":
				return (
					this.readingEntry(
						precondition.reading,
					)?.attestations.includes(precondition.value) ?? false
				);
		}
	}

	/**
	 * A direct Semantic Relation names a stored Lemma or Reading; naming a
	 * missing one is an invalid change, so the commit fails and writes nothing.
	 */
	assertTargetsStored(
		targetKind: unknown,
		targets: readonly unknown[],
	): void {
		for (const target of targets) {
			const stored =
				targetKind === "reading"
					? this.readingEntry(target as Dumling.Reading<"de">)
					: this.data(lemmaKeyOf(target as Dumling.Lemma<"de">));
			if (!stored)
				throw new Error(
					`A Semantic Relation target ${targetKind === "reading" ? "Reading" : "Lemma"} is missing.`,
				);
		}
	}
}

function readingIndex(
	note: StagedNote,
	reading: Dumling.Reading<"de">,
): number {
	const key = readingKeyOf(reading);
	return note.data.readingEntries.findIndex(
		(entry) => readingKeyOf(entry.reading) === key,
	);
}

function apply(view: StagedView, change: PlannedChangeOp<"de">): boolean {
	switch (change.type) {
		case "createLemma":
			view.create(change.record);
			return true;
		case "createReading": {
			const note = view.stage(lemmaKeyOf(change.entry.reading.lemma));
			if (!note) return false;
			const relations = change.entry.knowledge?.semanticRelations as
				| Readonly<Record<string, unknown>>
				| undefined;
			if (relations)
				for (const [relation, targets] of Object.entries(relations))
					if (relation !== "targetKind" && Array.isArray(targets))
						view.assertTargetsStored(relations.targetKind, targets);
			note.data.readingEntries.push(change.entry);
			return true;
		}
		case "createOwnedSurface": {
			const note = view.stage(lemmaKeyOf(change.entry.ownerLemma));
			if (!note) return false;
			note.data.ownedSurfaceEntries.push(change.entry);
			return true;
		}
		case "createPendingSemanticRelation": {
			const note = view.stage(
				lemmaKeyOf(change.record.sourceReading.lemma),
			);
			if (!note) return false;
			note.data.pendingRelations.push(change.record);
			return true;
		}
		case "deletePendingSemanticRelation": {
			const note = view.stage(
				lemmaKeyOf(change.record.sourceReading.lemma),
			);
			if (!note) return false;
			const key = locatorKeyOf(change.record.locator);
			note.data.pendingRelations = note.data.pendingRelations.filter(
				(record) => locatorKeyOf(record.locator) !== key,
			);
			return true;
		}
		case "patchReading": {
			const note = view.stage(lemmaKeyOf(change.reading.lemma));
			if (!note) return false;
			const at = readingIndex(note, change.reading);
			let entry = note.data.readingEntries[at];
			if (!entry) return false;
			for (const op of change.ops) {
				if (op.kind === "addAttestation") {
					entry = {
						...entry,
						attestations: [...entry.attestations, op.value],
					};
					continue;
				}
				const knowledgeChange = op.envelope.change;
				if (
					knowledgeChange.aspect === "semanticRelations" &&
					"value" in knowledgeChange
				)
					view.assertTargetsStored(
						knowledgeChange.targetKind,
						knowledgeChange.value as readonly unknown[],
					);
				entry = applyDumdictKnowledgeChanges(entry, [op.envelope]);
			}
			note.data.readingEntries[at] = entry;
			return true;
		}
	}
}

/**
 * Stages a commit's changes in order over the index, checking each one's
 * own and implied preconditions against the changes before it. It throws
 * for a change the stored state refuses outright, such as a relation to a
 * missing Lemma; the caller turns that into a request error.
 */
export function stageChanges(
	index: NoteIndex,
	revision: StoreRevision,
	changes: readonly PlannedChangeOp<"de">[],
): StagedChanges {
	const view = new StagedView(index, revision);
	for (const [changeIndex, change] of changes.entries()) {
		const preconditions = [
			...change.preconditions,
			...impliedChangePreconditions(change),
		];
		if (preconditions.some((precondition) => view.fails(precondition)))
			return { _tag: "PreconditionFailed", changeIndex };
		if (!apply(view, change))
			return { _tag: "PreconditionFailed", changeIndex };
	}
	return { _tag: "Staged", notes: [...view.notes.values()] };
}
