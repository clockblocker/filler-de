import type { LexicalMeta } from "@textfresser/lexical-generation";
import type { SectionKey } from "../contracts/section-key";

export type TypedNoteSection = {
	kind: "typed";
	key: SectionKey;
	marker: string;
	title: string;
	content: string;
};

export type RawNoteSection = {
	kind: "raw";
	rawBlock: string;
	marker?: string;
	title?: string;
	key?: SectionKey;
};

export type NoteSection = TypedNoteSection | RawNoteSection;

export type DictEntryMeta = {
	lexicalMeta?: LexicalMeta;
} & Record<string, unknown>;

export type NoteEntry = {
	id: string;
	headerContent: string;
	meta: DictEntryMeta;
	sections: NoteSection[];
};

export type SerializeNoteResult = {
	body: string;
	meta: Record<string, unknown>;
};
