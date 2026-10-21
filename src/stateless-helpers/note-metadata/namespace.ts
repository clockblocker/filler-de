/**
 * Metadata namespaces: each owner of note metadata (the Library, the
 * dictionary) reads and writes its own part of a note's metadata document
 * through a namespace, and never touches another namespace's keys.
 */

import { Predicate } from "effect";
import type { z } from "zod";
import { editDocument, type MetadataDocument } from "./internal/document";

/**
 * Where metadata is written. "Hide metadata" on selects `Hidden`, the
 * invisible section at the end of the note; off selects `Frontmatter`.
 */
export type MetadataFormat = "Hidden" | "Frontmatter";

export function otherFormat(format: MetadataFormat): MetadataFormat {
	return format === "Hidden" ? "Frontmatter" : "Hidden";
}

/** Why a namespace's stored data could not be read. */
export type MetadataIssue =
	| { readonly kind: "SchemaMismatch"; readonly message: string }
	| { readonly kind: "MissingVersion" }
	| {
			readonly kind: "NewerVersion";
			readonly found: number;
			readonly supported: number;
	  }
	| {
			readonly kind: "MigrationFailed";
			readonly from: number;
			readonly message: string;
	  };

/** A namespace's data as decoded from one format's document. */
type MetadataDecoding<T> =
	| { readonly kind: "Absent" }
	| { readonly kind: "Valid"; readonly value: T }
	| { readonly kind: "Invalid"; readonly issue: MetadataIssue };

/** A namespace's data as read from a note, with the format it came from. */
export type MetadataReading<T> =
	| { readonly kind: "Absent" }
	| {
			readonly kind: "Valid";
			readonly value: T;
			readonly format: MetadataFormat;
	  }
	| {
			readonly kind: "Invalid";
			readonly issue: MetadataIssue;
			readonly format: MetadataFormat;
	  };

/**
 * A metadata namespace. All operations are pure and work on one format's
 * metadata document; the facility picks the document and writes it back.
 */
export type MetadataNamespace<T> = {
	readonly name: string;
	decode(
		document: MetadataDocument,
		format: MetadataFormat,
	): MetadataDecoding<T>;
	/**
	 * `document` with this namespace's data replaced by `value`. Throws
	 * `NoteMetadataError` when `value` does not satisfy the schema.
	 */
	encode(
		document: MetadataDocument,
		value: T,
		format: MetadataFormat,
	): MetadataDocument;
	/** `document` without this namespace's keys. */
	remove(document: MetadataDocument): MetadataDocument;
	/**
	 * Moves this namespace's data from one format's document into the
	 * other's, replacing what the target held. Returns null when the source
	 * holds none, and an issue when it holds data that cannot be moved.
	 */
	transfer(
		from: MetadataDocument,
		fromFormat: MetadataFormat,
		to: MetadataDocument,
	):
		| null
		| { readonly issue: MetadataIssue }
		| { readonly from: MetadataDocument; readonly to: MetadataDocument };
};

/** Any namespace, whatever its value type. */
// biome-ignore lint/suspicious/noExplicitAny: namespaces of different value types share one list; their methods are bivariant.
export type AnyMetadataNamespace = MetadataNamespace<any>;

export type NoteMetadataErrorReason =
	| { readonly kind: "InvalidValue"; readonly message: string }
	| { readonly kind: "UnreadableFrontmatter" }
	| { readonly kind: "UnreadableData"; readonly issue: MetadataIssue };

/**
 * Thrown by a transform that cannot write without losing data: the value
 * breaks its schema, the frontmatter is not a readable YAML mapping, or an
 * update finds data it cannot decode (such as a newer `schemaVersion`).
 * Inside `Vault.process` the throw aborts the write.
 */
export class NoteMetadataError extends Error {
	override readonly name = "NoteMetadataError";
	constructor(
		readonly namespace: string,
		readonly reason: NoteMetadataErrorReason,
	) {
		super(`[note-metadata:${namespace}] ${describeReason(reason)}`);
	}
}

function describeReason(reason: NoteMetadataErrorReason): string {
	switch (reason.kind) {
		case "InvalidValue":
			return `value breaks the schema: ${reason.message}`;
		case "UnreadableFrontmatter":
			return "frontmatter is not a readable YAML mapping";
		case "UnreadableData":
			return `stored data is unreadable: ${reason.issue.kind}`;
	}
}

// ─── Nested namespaces ───

/** The key a nested namespace records its version under. */
const SCHEMA_VERSION_KEY = "schemaVersion";

export type NestedNamespaceSpec<T extends Record<string, unknown>> = {
	readonly name: string;
	/** The document key holding the namespace's object. */
	readonly key: string;
	/** The current version, from 1 up. */
	readonly version: number;
	/** The current version's shape, without `schemaVersion`. */
	readonly schema: z.ZodType<T>;
	/**
	 * `migrations[n]` turns version `n` data into version `n + 1` data.
	 * Reading data of an older version runs them in order before the schema.
	 */
	readonly migrations?: Readonly<Record<number, (data: unknown) => unknown>>;
};

/**
 * A namespace stored as one object under `key`, the same in both formats:
 *
 * ```json
 * { "<key>": { "schemaVersion": 2, ...value } }
 * ```
 *
 * Reading checks the version, migrates older data, then validates it with
 * the schema. Data from a newer version is reported, never rewritten.
 */
export function defineNestedNamespace<T extends Record<string, unknown>>(
	spec: NestedNamespaceSpec<T>,
): MetadataNamespace<T> {
	const { key, name, schema, version } = spec;
	const migrations = spec.migrations ?? {};

	const decode = (document: MetadataDocument): MetadataDecoding<T> => {
		const stored = document[key];
		if (stored === undefined) return { kind: "Absent" };
		if (!Predicate.isObject(stored)) {
			return invalid({
				kind: "SchemaMismatch",
				message: `${key} is not an object`,
			});
		}
		const found = stored[SCHEMA_VERSION_KEY];
		if (!Predicate.isNumber(found) || !Number.isInteger(found) || found < 1)
			return invalid({ kind: "MissingVersion" });
		if (found > version)
			return invalid({ found, kind: "NewerVersion", supported: version });

		const { [SCHEMA_VERSION_KEY]: _version, ...rest } = stored;
		let data: unknown = rest;
		for (let from = found; from < version; from++) {
			const migrate = migrations[from];
			if (!migrate) {
				return invalid({
					from,
					kind: "MigrationFailed",
					message: `no migration from version ${from}`,
				});
			}
			try {
				data = migrate(data);
			} catch (error) {
				return invalid({
					from,
					kind: "MigrationFailed",
					message:
						error instanceof Error ? error.message : String(error),
				});
			}
		}
		const parsed = schema.safeParse(data);
		return parsed.success
			? { kind: "Valid", value: parsed.data }
			: invalid({
					kind: "SchemaMismatch",
					message: parsed.error.message,
				});
	};

	const encode = (document: MetadataDocument, value: T): MetadataDocument => {
		const parsed = schema.safeParse(value);
		if (!parsed.success) {
			throw new NoteMetadataError(name, {
				kind: "InvalidValue",
				message: parsed.error.message,
			});
		}
		const { [SCHEMA_VERSION_KEY]: _ignored, ...data } = parsed.data;
		return editDocument(document, {
			[key]: { [SCHEMA_VERSION_KEY]: version, ...data },
		});
	};

	const remove = (document: MetadataDocument): MetadataDocument =>
		editDocument(document, {}, [key]);

	return {
		decode,
		encode,
		name,
		remove,
		// Stored the same way in both formats: move it as is, whatever its
		// version, so nothing is lost.
		transfer: (from, _fromFormat, to) =>
			from[key] === undefined
				? null
				: {
						from: remove(from),
						to: editDocument(to, { [key]: from[key] }),
					},
	};
}

function invalid(issue: MetadataIssue): MetadataDecoding<never> {
	return { issue, kind: "Invalid" };
}
