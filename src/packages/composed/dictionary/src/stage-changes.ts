import type {
	AttestationLink,
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
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { lemmaKeyOf, locatorKeyOf, readingKeyOf } from "./keys";
import type { NoteIndex } from "./note-index";
import type { NoteData } from "./notes";

type MutableData = {
	lemmaRecord: NoteData["lemmaRecord"];
	readingEntries: ReadingEntry<"de">[];
	ownedSurfaceEntries: SurfaceEntry<"de">[];
	pendingRelations: PendingSemanticRelationRecord<"de">[];
};

/** One Lemma's records as a commit stages them. */
type StagedNote = {
	readonly lemmaKey: string;
	/** The records the index holds; absent for a new Lemma. */
	readonly base: NoteData | undefined;
	/** The records once the commit lands; absent for a deleted Lemma. */
	data: MutableData | undefined;
};

export type StagedChanges =
	| { readonly _tag: "Staged"; readonly notes: readonly StagedNote[] }
	| { readonly _tag: "PreconditionFailed"; readonly changeIndex: number };

const sameLink = (
	left: AttestationLink<"de">,
	right: AttestationLink<"de">,
): boolean =>
	left.ref === right.ref &&
	left.surfaceId === right.surfaceId &&
	readingIdentityKey(left.reading) === readingIdentityKey(right.reading);

const copyOf = (data: NoteData): MutableData => ({
	lemmaRecord: data.lemmaRecord,
	ownedSurfaceEntries: [...data.ownedSurfaceEntries],
	pendingRelations: [...data.pendingRelations],
	readingEntries: [...data.readingEntries],
});

/**
 * A copy-on-write fork of the index: the Lemmas a commit touched, staged
 * over the index it read. Reads see staged Lemmas first, so each change's
 * preconditions are checked against the changes before it.
 */
class StagedView {
	readonly notes = new Map<string, StagedNote>();

	constructor(
		private readonly index: NoteIndex,
		private readonly revision: StoreRevision,
	) {}

	data(lemmaKey: string): MutableData | NoteData | undefined {
		const staged = this.notes.get(lemmaKey);
		return staged ? staged.data : this.index.lemmaData(lemmaKey);
	}

	/** The staged records of a stored Lemma, copied from the index on first touch. */
	stage(lemmaKey: string): MutableData | undefined {
		const staged = this.notes.get(lemmaKey);
		if (staged) return staged.data;
		const base = this.index.lemmaData(lemmaKey);
		if (!base) return undefined;
		const data = copyOf(base);
		this.notes.set(lemmaKey, { base, data, lemmaKey });
		return data;
	}

	create(record: NoteData["lemmaRecord"]): void {
		const lemmaKey = lemmaKeyOf(record.lemma);
		const data: MutableData = {
			lemmaRecord: record,
			ownedSurfaceEntries: [],
			pendingRelations: [],
			readingEntries: [],
		};
		const staged = this.notes.get(lemmaKey);
		if (staged) staged.data = data;
		else
			this.notes.set(lemmaKey, {
				base: this.index.lemmaData(lemmaKey),
				data,
				lemmaKey,
			});
	}

	delete(lemmaKey: string): boolean {
		if (!this.stage(lemmaKey)) return false;
		const staged = this.notes.get(lemmaKey);
		if (staged) staged.data = undefined;
		return true;
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
				note.data?.ownedSurfaceEntries.some(
					({ id }) => id === surfaceId,
				)
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

	/** Every link with this ref in the whole dictionary as staged. */
	linksWithRef(ref: string): AttestationLink<"de">[] {
		const links: AttestationLink<"de">[] = [];
		for (const note of this.notes.values())
			for (const entry of note.data?.readingEntries ?? [])
				for (const link of entry.attestationLinks)
					if (link.ref === ref) links.push(link);
		for (const link of this.index.linksWithRef(ref))
			if (!this.notes.has(lemmaKeyOf(link.reading.lemma)))
				links.push(link);
		return links;
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
			case "attestationMissing":
				return this.linksWithRef(precondition.ref).length > 0;
			case "attestationLinkExists":
				return !this.linksWithRef(precondition.link.ref).some((link) =>
					sameLink(link, precondition.link),
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

function readingAt(data: MutableData, reading: Dumling.Reading<"de">): number {
	const key = readingKeyOf(reading);
	return data.readingEntries.findIndex(
		(entry) => readingKeyOf(entry.reading) === key,
	);
}

function apply(view: StagedView, change: PlannedChangeOp<"de">): boolean {
	switch (change.type) {
		case "createLemma":
			view.create(change.record);
			return true;
		case "deleteLemma":
			return view.delete(lemmaKeyOf(change.lemma));
		case "setLemmaParadigm": {
			const data = view.stage(lemmaKeyOf(change.lemma));
			if (!data) return false;
			data.lemmaRecord = {
				lemma: data.lemmaRecord.lemma,
				...(change.paradigm === undefined
					? {}
					: { paradigm: change.paradigm }),
			};
			return true;
		}
		case "createReading": {
			const data = view.stage(lemmaKeyOf(change.entry.reading.lemma));
			if (!data) return false;
			const relations = change.entry.knowledge?.semanticRelations as
				| Readonly<Record<string, unknown>>
				| undefined;
			if (relations)
				for (const [relation, targets] of Object.entries(relations))
					if (relation !== "targetKind" && Array.isArray(targets))
						view.assertTargetsStored(relations.targetKind, targets);
			data.readingEntries.push(change.entry);
			return true;
		}
		case "deleteReading": {
			const data = view.stage(lemmaKeyOf(change.reading.lemma));
			if (!data) return false;
			const at = readingAt(data, change.reading);
			if (at < 0) return false;
			const key = readingKeyOf(change.reading);
			data.readingEntries.splice(at, 1);
			// A pending relation lives in its source's note, so it goes with it.
			data.pendingRelations = data.pendingRelations.filter(
				({ sourceReading }) => readingKeyOf(sourceReading) !== key,
			);
			return true;
		}
		case "createOwnedSurface": {
			const data = view.stage(lemmaKeyOf(change.entry.ownerLemma));
			if (!data) return false;
			data.ownedSurfaceEntries.push(change.entry);
			return true;
		}
		case "deleteOwnedSurface": {
			const data = view.stage(lemmaKeyOf(change.ownerLemma));
			if (!data) return false;
			const before = data.ownedSurfaceEntries.length;
			data.ownedSurfaceEntries = data.ownedSurfaceEntries.filter(
				({ id }) => id !== change.surfaceId,
			);
			return data.ownedSurfaceEntries.length < before;
		}
		case "createPendingSemanticRelation": {
			const data = view.stage(
				lemmaKeyOf(change.record.sourceReading.lemma),
			);
			if (!data) return false;
			data.pendingRelations.push(change.record);
			return true;
		}
		case "deletePendingSemanticRelation": {
			const data = view.stage(
				lemmaKeyOf(change.record.sourceReading.lemma),
			);
			if (!data) return false;
			const key = locatorKeyOf(change.record.locator);
			data.pendingRelations = data.pendingRelations.filter(
				(record) => locatorKeyOf(record.locator) !== key,
			);
			return true;
		}
		case "patchReading": {
			const data = view.stage(lemmaKeyOf(change.reading.lemma));
			if (!data) return false;
			const at = readingAt(data, change.reading);
			let entry = data.readingEntries[at];
			if (!entry) return false;
			for (const op of change.ops) {
				if (op.kind === "addAttestationLink") {
					entry = {
						...entry,
						attestationLinks: [...entry.attestationLinks, op.link],
					};
					continue;
				}
				if (op.kind === "removeAttestationLink") {
					const { link } = op;
					entry = {
						...entry,
						attestationLinks: entry.attestationLinks.filter(
							(stored) => !sameLink(stored, link),
						),
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
			data.readingEntries[at] = entry;
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
