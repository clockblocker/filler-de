/**
 * The Library's namespace: a Scroll's or Page's Reading Status and kind, and
 * a Codex's file type.
 *
 * It predates namespaces, so its keys sit at the top level of the document,
 * as they always have:
 * - hidden: `{"status":"Done","noteKind":"Page"}`;
 * - frontmatter: `status: true` (a checkbox), `noteKind: Page`.
 *
 * This layout is version 1 and records no `schemaVersion`, so no Library
 * note changes on disk. A later version would move the data under a
 * `library` key with a migration that reads these top-level keys.
 */

import { z } from "zod";
import { MdFileSubTypeSchema } from "../../types/common-interface/enums";
import { editDocument, type MetadataDocument } from "./internal/document";
import {
	type MetadataFormat,
	type MetadataNamespace,
	NoteMetadataError,
	otherFormat,
} from "./namespace";

const LIBRARY_NAMESPACE = "library";

const LibraryStatusSchema = z.enum(["Done", "NotStarted"]);

const LibraryMetadataSchema = z.object({
	fileType: MdFileSubTypeSchema.optional(),
	noteKind: MdFileSubTypeSchema.optional(),
	status: LibraryStatusSchema.optional(),
});

export type LibraryMetadataValue = z.infer<typeof LibraryMetadataSchema>;

const KEYS = ["status", "noteKind", "fileType"] as const;

/** Values that read as Done; any other stored status reads as NotStarted. */
const DONE_VALUES: ReadonlySet<unknown> = new Set([
	true,
	"true",
	"done",
	"Done",
	"completed",
	"Completed",
]);

function decodeValue(document: MetadataDocument): LibraryMetadataValue | null {
	if (KEYS.every((key) => document[key] === undefined)) return null;
	const { status } = document;
	const noteKind = MdFileSubTypeSchema.safeParse(document.noteKind);
	const fileType = MdFileSubTypeSchema.safeParse(document.fileType);
	return {
		...(fileType.success ? { fileType: fileType.data } : {}),
		...(noteKind.success ? { noteKind: noteKind.data } : {}),
		...(status === undefined || status === null
			? {}
			: { status: DONE_VALUES.has(status) ? "Done" : "NotStarted" }),
	};
}

function encodeValue(
	document: MetadataDocument,
	value: LibraryMetadataValue,
	format: MetadataFormat,
): MetadataDocument {
	const parsed = LibraryMetadataSchema.safeParse(value);
	if (!parsed.success) {
		throw new NoteMetadataError({
			namespace: LIBRARY_NAMESPACE,
			reason: {
				kind: "InvalidValue",
				message: parsed.error.message,
			},
		});
	}
	const { fileType, noteKind, status } = parsed.data;
	return editDocument(
		document,
		{
			fileType,
			noteKind,
			// Frontmatter keeps the status as a checkbox.
			status:
				status === undefined || format === "Hidden"
					? status
					: status === "Done",
		},
		KEYS,
	);
}

function removeValue(document: MetadataDocument): MetadataDocument {
	return editDocument(document, {}, KEYS);
}

export const LibraryMetadata: MetadataNamespace<LibraryMetadataValue> = {
	decode: (document) => {
		const value = decodeValue(document);
		return value ? { kind: "Valid", value } : { kind: "Absent" };
	},
	encode: encodeValue,
	name: LIBRARY_NAMESPACE,
	remove: removeValue,
	transfer: (from, fromFormat, to) => {
		const value = decodeValue(from);
		if (!value) return null;
		return {
			from: removeValue(from),
			to: encodeValue(to, value, otherFormat(fromFormat)),
		};
	},
};
