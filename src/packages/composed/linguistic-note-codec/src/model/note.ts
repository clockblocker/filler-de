import type { AnyLemma } from "@textfresser/linguistics";

import type {
	AttestationPayload,
	EntryBlock,
	FreeformBlockPayload,
	HeaderPayload,
	InherentFeaturesPayload,
	InflectionPayload,
	KnownSelection,
	RelationPayload,
	TagsPayload,
	TranslationPayload,
} from "./blocks";

export type EntryDocument = {
	blocks: EntryBlock[];
	sourceMarkdown?: string;
};

export type EntryPayload = {
	attestations?: AttestationPayload[];
	freeform?: FreeformBlockPayload[];
	header?: HeaderPayload;
	inflection?: InflectionPayload;
	inherentFeatures?: InherentFeaturesPayload;
	relation?: RelationPayload;
	tags?: TagsPayload;
	translations?: TranslationPayload;
};

export type EntryData =
	| {
			kind: "lemma";
			lemma: AnyLemma;
			payload: EntryPayload;
	  }
	| {
			kind: "selection";
			payload: EntryPayload;
			selection: KnownSelection;
	  };

export type PartialRootSummary = {
	discriminator?: string;
	entryKind?: "lemma" | "selection";
	language?: string;
	lemmaKind?: string;
	spelledLemma?: string;
	spelledSurface?: string;
};

export type PartialEntryData =
	| EntryData
	| {
			blocks: EntryBlock[];
			kind: "invalid";
			partialPayload?: Partial<EntryPayload>;
			partialRoot?: PartialRootSummary;
			reconstructionTarget: "lemma" | "selection" | "unknown";
	  };

export type NoteDocument = {
	entries: EntryDocument[];
	meta?: Record<string, unknown>;
};

export type NoteData = {
	entries: EntryData[];
	meta?: Record<string, unknown>;
};

export type PartialNoteData = {
	entries: PartialEntryData[];
	meta?: Record<string, unknown>;
};
