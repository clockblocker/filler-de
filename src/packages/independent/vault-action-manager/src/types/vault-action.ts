// ─── Vault Action Definitions (moved here for platform boundary) ───

// NOTE: Must stay v4 — VaultActionKindSchema uses z.enum with mapped template
// literals that only infer correctly in v4. Switching to v3 breaks discriminated
// union narrowing in all consuming files (collapse.ts, executor.ts, etc.).
import z from "zod";
import {
	CREATE,
	FILE,
	FOLDER,
	MD_FILE,
	PROCESS,
	RENAME,
	TRASH,
	UPSERT,
} from "./literals";
import type {
	SplitPathFromTo,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./split-path";

// Operations allowed per target
const FolderOps = z.enum([CREATE, RENAME, TRASH] as const);
const FileOps = z.enum([CREATE, RENAME, TRASH] as const);
const MdFileOps = z.enum([CREATE, UPSERT, PROCESS, RENAME, TRASH] as const);

const TargetSchema = z.enum([FOLDER, FILE, MD_FILE] as const);
const Target = TargetSchema.enum;

export const VaultActionKindSchema = z.enum([
	...FolderOps.options.map((op) => `${op}${Target.Folder}` as const),
	...FileOps.options.map((op) => `${op}${Target.File}` as const),
	...MdFileOps.options.map((op) => `${op}${Target.MdFile}` as const),
] as const);

export const VaultActionKind = VaultActionKindSchema.enum;
export type VaultActionKind = z.infer<typeof VaultActionKindSchema>;

export type Transform = (content: string) => string | Promise<string>;

/**
 * What a file must hold for a guarded action to run: its whole content, or
 * the `vaultContentHash` of it, such as a dispatch report's `afterHash`.
 */
export type ExpectedContent = string | { readonly hash: string };

/**
 * What a rename does when its target is taken, by the exact path or by a
 * name the vault's file system holds to be the same:
 *
 * - `fail`: fails with `VamTargetExistsError` (kind `exists`) and moves
 *   nothing. A missing source fails too (kind `missing`).
 * - `index`: moves the source to the first free `1_<name>`, `2_<name>`, …
 *   (`RenamedToIndexed`).
 * - `dedupe`: like `index`, except that a Markdown source whose content the
 *   target already holds goes to the trash (`TrashedDuplicate`).
 *
 * With `index` and `dedupe`, a rename whose source is gone and whose target
 * is there counts as done (`NoOp`).
 */
export type RenameCollision = "fail" | "index" | "dedupe";

// Folder payloads
type CreateFolderPayload = {
	splitPath: SplitPathToFolder;
	content?: string;
};
type RenameFolderPayload = SplitPathFromTo<SplitPathToFolder> & {
	/** What happens when the target is taken. Defaults to `index`. */
	onCollision?: Exclude<RenameCollision, "dedupe">;
	/**
	 * Whether Obsidian rewrites links to the moved files, as its "Automatically
	 * update internal links" setting asks. Defaults to true. False moves the
	 * folder without touching any file's content, the moved notes included.
	 */
	updateLinks?: boolean;
};
type TrashFolderPayload = { splitPath: SplitPathToFolder };

// File payloads
type CreateFilePayload = {
	splitPath: SplitPathToFile;
	content?: string;
};
type RenameFilePayload = SplitPathFromTo<SplitPathToFile> & {
	/** What happens when the target is taken. Defaults to `index`. */
	onCollision?: Exclude<RenameCollision, "dedupe">;
};
type TrashFilePayload = { splitPath: SplitPathToFile };

// MdFile payloads
type CreateMdFilePayload = {
	splitPath: SplitPathToMdFile;
	/** Content to create the file with; empty when omitted. */
	content?: string;
};
type UpsertMdFilePayload = {
	splitPath: SplitPathToMdFile;
	/**
	 * Content to write. If null or undefined, ensures file exists without overwriting existing content.
	 * If empty string, creates with empty content.
	 */
	content?: string | null;
};
type RenameMdFilePayload = SplitPathFromTo<SplitPathToMdFile> & {
	/** What happens when the target is taken. Defaults to `dedupe`. */
	onCollision?: RenameCollision;
	/**
	 * Whether Obsidian rewrites links to the moved note, as its "Automatically
	 * update internal links" setting asks. Defaults to true. False moves the
	 * note without touching any file's content: links keep their text and
	 * resolve wherever Obsidian then resolves them.
	 */
	updateLinks?: boolean;
};
type TrashMdFilePayload = {
	splitPath: SplitPathToMdFile;
	/**
	 * Trash the file only while it holds this content, as `readContent`
	 * routes it: an open view's unsaved buffer, active or not, or the disk.
	 * Otherwise, or when the file's open views disagree, the action fails
	 * with `VamContentConflictError` (kind `conflict`) and trashes nothing.
	 * A file already gone is a `NoOp`.
	 */
	ifContent?: ExpectedContent;
};
type ProcessMdFileGuard = {
	/**
	 * The content the transform must receive. Otherwise the action fails with
	 * `VamContentConflictError` (kind `conflict`) before anything is written.
	 * The transform receives what `readContent` returns: an open view's
	 * unsaved buffer, active or not, or the disk. On the disk the check runs
	 * inside the same `Vault.process` call as the write.
	 */
	expected?: ExpectedContent;
};
type ProcessMdFilePayload = ProcessMdFileGuard &
	(
		| { splitPath: SplitPathToMdFile; transform: Transform }
		| { splitPath: SplitPathToMdFile; before: string; after: string }
	);

export type VaultAction =
	| {
			kind: typeof VaultActionKind.CreateFolder;
			payload: CreateFolderPayload;
	  }
	| {
			kind: typeof VaultActionKind.RenameFolder;
			payload: RenameFolderPayload;
	  }
	| { kind: typeof VaultActionKind.TrashFolder; payload: TrashFolderPayload }
	| { kind: typeof VaultActionKind.CreateFile; payload: CreateFilePayload }
	| { kind: typeof VaultActionKind.RenameFile; payload: RenameFilePayload }
	| { kind: typeof VaultActionKind.TrashFile; payload: TrashFilePayload }
	| {
			kind: typeof VaultActionKind.CreateMdFile;
			payload: CreateMdFilePayload;
	  }
	| {
			kind: typeof VaultActionKind.UpsertMdFile;
			payload: UpsertMdFilePayload;
	  }
	| {
			kind: typeof VaultActionKind.RenameMdFile;
			payload: RenameMdFilePayload;
	  }
	| { kind: typeof VaultActionKind.TrashMdFile; payload: TrashMdFilePayload }
	| {
			kind: typeof VaultActionKind.ProcessMdFile;
			payload: ProcessMdFilePayload;
	  };
