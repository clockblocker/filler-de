/**
 * What `Worter/` holds after a reset (#117), read from the files: Lemma,
 * Reading and Crossroad notes, told apart by their dictionary metadata
 * (#112), and any Shadow note, which the current layout never writes
 * (#109) and the report would flag.
 */
import { CrossroadNoteMetadata } from "@textfresser/dictionary";
import {
	type AnyMetadataNamespace,
	LemmaNoteMetadata,
	noteMetadataHelper,
	ReadingNoteMetadata,
} from "../../stateless-helpers/note-metadata";
import type { OldFile } from "./plan";

type DictionaryNoteKind = "Lemma" | "Reading" | "Crossroad";

const NAMESPACES: readonly [DictionaryNoteKind, AnyMetadataNamespace][] = [
	["Lemma", LemmaNoteMetadata],
	["Reading", ReadingNoteMetadata],
	["Crossroad", CrossroadNoteMetadata],
];

/** The kind of dictionary note whose metadata, in either format, a note holds. */
export function dictionaryNoteKind(
	content: string,
): DictionaryNoteKind | undefined {
	return NAMESPACES.find(
		([, namespace]) =>
			noteMetadataHelper.inspect(content, namespace, "Hidden").kind !==
			"Absent",
	)?.[0];
}

export type ResetLayout = {
	readonly lemmaNotes: readonly string[];
	readonly readingNotes: readonly string[];
	readonly crossroadNotes: readonly string[];
	/** Notes under `Worter/<lang>/Shadow/` or marked `%%tf:shadow`: none, if all is well. */
	readonly shadowNotes: readonly string[];
	/** Everything else, such as a note the user made meanwhile. */
	readonly otherNotes: readonly string[];
};

const isShadow = ({ content, path }: OldFile) =>
	path.split("/")[2] === "Shadow" || /^%%tf:shadow\b/mu.test(content);

export function layoutOf(files: readonly OldFile[]): ResetLayout {
	const layout = {
		crossroadNotes: [] as string[],
		lemmaNotes: [] as string[],
		otherNotes: [] as string[],
		readingNotes: [] as string[],
		shadowNotes: [] as string[],
	};
	for (const file of [...files].sort((a, b) =>
		a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
	)) {
		if (isShadow(file)) {
			layout.shadowNotes.push(file.path);
			continue;
		}
		const kind = dictionaryNoteKind(file.content);
		if (kind === "Lemma") layout.lemmaNotes.push(file.path);
		else if (kind === "Reading") layout.readingNotes.push(file.path);
		else if (kind === "Crossroad") layout.crossroadNotes.push(file.path);
		else layout.otherNotes.push(file.path);
	}
	return layout;
}
