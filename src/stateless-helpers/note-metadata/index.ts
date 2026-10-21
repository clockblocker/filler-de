/**
 * The note-metadata facility: typed, versioned metadata per note, stored in
 * the format "Hide metadata" selects. See `src/documentaion/note-metadata.md`.
 *
 * Every transform here is a pure, synchronous `(content) => content`
 * function. VAM runs them inside `Vault.process`, and the dictionary store
 * can run them inside its compare-and-swap rewrite. Each is idempotent:
 * applying it to its own output gives the same bytes.
 */

import { getParsedUserSettings } from "../../global-state/global-state";
import type { MetadataDocument } from "./internal/document";
import { editDocument, isEmptyDocument } from "./internal/document";
import { joinNote, type NoteLayout, splitNote } from "./internal/note-layout";
import { LibraryMetadata, type LibraryMetadataValue } from "./library-metadata";
import {
	type AnyMetadataNamespace,
	type MetadataFormat,
	type MetadataIssue,
	type MetadataNamespace,
	type MetadataReading,
	NoteMetadataError,
	otherFormat,
} from "./namespace";

export {
	LemmaNoteMetadata,
	ReadingNoteMetadata,
} from "./dictionary-metadata";
export { LibraryMetadata } from "./library-metadata";
export {
	type AnyMetadataNamespace,
	defineNestedNamespace,
	type MetadataFormat,
	type MetadataIssue,
	type MetadataNamespace,
	NoteMetadataError,
} from "./namespace";

/** A pure rewrite of a note's content. */
export type MetadataTransform = (content: string) => string;

/** The format "Hide metadata" currently selects. */
function currentMetadataFormat(): MetadataFormat {
	return getParsedUserSettings().hideMetadata ? "Hidden" : "Frontmatter";
}

// ─── Reading ───

type Documents = {
	readonly Frontmatter: MetadataDocument | null;
	readonly Hidden: MetadataDocument | null;
};

function documentsOf(layout: NoteLayout): Documents {
	return {
		Frontmatter: layout.frontmatter?.document ?? null,
		Hidden: layout.hidden?.document ?? null,
	};
}

function readFrom<T>(
	documents: Documents,
	namespace: MetadataNamespace<T>,
	format: MetadataFormat,
): MetadataReading<T> {
	const document = documents[format];
	if (!document) return { kind: "Absent" };
	const decoded = namespace.decode(document, format);
	return decoded.kind === "Absent" ? decoded : { ...decoded, format };
}

/**
 * Reads `namespace` from `content`. Tries `prefer` first, by default the
 * current format, then the other one, so a note not yet migrated after the
 * toggle still reads. Returns the first valid reading; otherwise the first
 * invalid one, so callers can tell broken data from none.
 */
function inspect<T>(
	content: string,
	namespace: MetadataNamespace<T>,
	prefer: MetadataFormat = currentMetadataFormat(),
): MetadataReading<T> {
	const documents = documentsOf(splitNote(content));
	const first = readFrom(documents, namespace, prefer);
	if (first.kind === "Valid") return first;
	const second = readFrom(documents, namespace, otherFormat(prefer));
	if (second.kind === "Valid") return second;
	return first.kind === "Invalid" ? first : second;
}

/** The namespace's value, or null when it is absent or unreadable. */
function read<T>(
	content: string,
	namespace: MetadataNamespace<T>,
	prefer?: MetadataFormat,
): T | null {
	const reading = inspect(content, namespace, prefer);
	return reading.kind === "Valid" ? reading.value : null;
}

// ─── Writing ───

/**
 * Applies `edit` to the namespace's document in `format`, removes the
 * namespace from the other format, and writes the note back canonically.
 */
function editNamespace<T>(
	content: string,
	namespace: MetadataNamespace<T>,
	format: MetadataFormat,
	edit: (document: MetadataDocument) => MetadataDocument,
): string {
	const layout = splitNote(content);
	const documents = documentsOf(layout);
	const unreadableFrontmatter =
		layout.frontmatter !== null && layout.frontmatter.document === null;
	if (format === "Frontmatter" && unreadableFrontmatter) {
		throw new NoteMetadataError(namespace.name, {
			kind: "UnreadableFrontmatter",
		});
	}
	const target = edit(documents[format] ?? {});
	const source = documents[otherFormat(format)];
	const cleaned = source ? namespace.remove(source) : null;
	const frontmatter = format === "Frontmatter" ? target : cleaned;
	const hidden = format === "Hidden" ? target : cleaned;
	return joinNote(layout, { body: layout.body, frontmatter, hidden });
}

/**
 * Replaces the namespace's data with `value`, in `format` (by default the
 * current one), and removes it from the other format. Other namespaces'
 * data and the user's own frontmatter properties stay.
 */
function write<T>(
	namespace: MetadataNamespace<T>,
	value: T,
	format: MetadataFormat = currentMetadataFormat(),
): MetadataTransform {
	return (content) =>
		editNamespace(content, namespace, format, (document) =>
			namespace.encode(document, value, format),
		);
}

/**
 * Reads the namespace, passes its value (null when absent) to `change`,
 * and writes what it returns; null removes the namespace. Throws
 * `NoteMetadataError` instead of overwriting data it cannot read.
 */
function update<T>(
	namespace: MetadataNamespace<T>,
	change: (current: T | null) => T | null,
	format: MetadataFormat = currentMetadataFormat(),
): MetadataTransform {
	return (content) => {
		const reading = inspect(content, namespace, format);
		if (reading.kind === "Invalid") {
			throw new NoteMetadataError(namespace.name, {
				issue: reading.issue,
				kind: "UnreadableData",
			});
		}
		const next = change(reading.kind === "Valid" ? reading.value : null);
		return next === null
			? remove(namespace)(content)
			: write(namespace, next, format)(content);
	};
}

/** Removes the namespace's data from both formats. */
function remove<T>(namespace: MetadataNamespace<T>): MetadataTransform {
	return (content) => {
		const layout = splitNote(content);
		const { Frontmatter, Hidden } = documentsOf(layout);
		return joinNote(layout, {
			body: layout.body,
			frontmatter: Frontmatter ? namespace.remove(Frontmatter) : null,
			hidden: Hidden ? namespace.remove(Hidden) : null,
		});
	};
}

/**
 * Rewrites the visible body with `change` and keeps all metadata. The
 * hidden section is written canonically after the body's trailing
 * whitespace, so repeated passes cannot add blank lines.
 */
function mapBody(change: (body: string) => string): MetadataTransform {
	return (content) => {
		const layout = splitNote(content);
		return joinNote(layout, {
			body: change(layout.body),
			frontmatter: null,
			hidden: layout.hidden?.document ?? null,
		});
	};
}

// ─── Converting between formats ───

export type FormatConversion = {
	readonly content: string;
	/** Namespaces moved into the target format. */
	readonly moved: readonly string[];
	/** Namespaces left in place, with why. */
	readonly issues: readonly {
		readonly namespace: string;
		readonly issue:
			| MetadataIssue
			| { readonly kind: "UnreadableFrontmatter" };
	}[];
};

/**
 * Moves `namespaces` out of the other format into `target`, which wins over
 * anything the target already held for them. Data in a hidden section that
 * no namespace claims moves along with it, since the section only ever
 * holds the plugin's data, unless the frontmatter already has a property of
 * that name. The user's own frontmatter properties always stay.
 */
function convertNote(
	content: string,
	target: MetadataFormat,
	namespaces: readonly AnyMetadataNamespace[],
): FormatConversion {
	const layout = splitNote(content);
	const source = otherFormat(target);
	const documents = documentsOf(layout);
	const from = documents[source];
	if (!from || isEmptyDocument(from))
		return { content, issues: [], moved: [] };
	if (
		target === "Frontmatter" &&
		layout.frontmatter &&
		!documents.Frontmatter
	) {
		return {
			content,
			issues: namespaces.map(({ name }) => ({
				issue: { kind: "UnreadableFrontmatter" },
				namespace: name,
			})),
			moved: [],
		};
	}

	let remaining = from;
	let to = documents[target] ?? {};
	const moved: string[] = [];
	const issues: FormatConversion["issues"][number][] = [];
	for (const namespace of namespaces) {
		const result = namespace.transfer(remaining, source, to);
		if (result === null) continue;
		if ("issue" in result) {
			issues.push({ issue: result.issue, namespace: namespace.name });
			continue;
		}
		remaining = result.from;
		to = result.to;
		moved.push(namespace.name);
	}
	if (source === "Hidden" && issues.length === 0) {
		// Unclaimed keys never replace a property the user already has.
		const free = Object.keys(remaining).filter((key) => !(key in to));
		if (free.length > 0) {
			to = editDocument(
				to,
				Object.fromEntries(free.map((key) => [key, remaining[key]])),
			);
			remaining = editDocument(remaining, {}, free);
		}
	}
	if (moved.length === 0 && remaining === from) {
		return { content, issues, moved };
	}

	return {
		content: joinNote(layout, {
			body: layout.body,
			frontmatter: target === "Frontmatter" ? to : remaining,
			hidden: target === "Hidden" ? to : remaining,
		}),
		issues,
		moved,
	};
}

/** `convertNote` as a transform. */
function convertFormat(
	target: MetadataFormat,
	namespaces: readonly AnyMetadataNamespace[],
): MetadataTransform {
	return (content) => convertNote(content, target, namespaces).content;
}

// ─── Visible text ───

/** The visible body: no frontmatter, no hidden section, trimmed. */
function strip(content: string): string {
	return splitNote(content).body.trim();
}

/** The body, untrimmed, without frontmatter or hidden section. */
function body(content: string): string {
	return splitNote(content).body;
}

/** The content after the frontmatter, leading whitespace trimmed. */
function stripOnlyFrontmatter(content: string): string {
	const layout = splitNote(content);
	return content.slice(layout.frontmatter?.end ?? 0).trimStart();
}

/**
 * Where the hidden section's padding starts, so the body ends there, or
 * null when the note has no hidden section.
 */
function findSectionStart(content: string): number | null {
	const layout = splitNote(content);
	if (!layout.hidden) return null;
	const bodyStart = layout.frontmatter?.end ?? 0;
	return bodyStart + layout.body.trimEnd().length;
}

// ─── Library ───

/** Sets a Scroll's Reading Status, keeping its other Library metadata. */
function toggleStatus(checked: boolean): MetadataTransform {
	const status: LibraryMetadataValue["status"] = checked
		? "Done"
		: "NotStarted";
	return update(LibraryMetadata, (current) => ({ ...current, status }));
}

/**
 * The note-metadata facility's operations. Library code reaches it through
 * `library-core`'s re-export.
 */
export const noteMetadataHelper = {
	body,
	convertFormat,
	convertNote,
	findSectionStart,
	inspect,
	mapBody,
	read,
	remove,
	strip,
	stripOnlyFrontmatter,
	toggleStatus,
	update,
	write,
};
