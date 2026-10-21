/**
 * The reset's ports (#65, #117): the vault it reads, backs up and writes a
 * report into, and the dictionary store it regenerates through. Neither
 * offers a delete.
 */
import { type Effect, Schema } from "effect";
import type { OldFile, ResetSources } from "./plan";

export class ResetFailed extends Schema.TaggedError<ResetFailed>()(
	"ResetFailed",
	{
		cause: Schema.Defect(),
		message: Schema.String,
	},
) {}

/** A folder's files: Markdown with its content, and the paths of the rest. */
type FolderListing = {
	readonly markdown: readonly OldFile[];
	readonly other: readonly string[];
};

/** The reads and the few writes the reset makes, without any delete. */
export type ResetVault = ResetSources & {
	/** Every file below `folder`; undefined when there is no such folder. */
	readonly listFolder: (
		folder: string,
	) => Effect.Effect<FolderListing | undefined, ResetFailed>;
	/** The names of the folders at the vault's root. */
	readonly listRootFolders: Effect.Effect<readonly string[], ResetFailed>;
	readonly exists: (path: string) => Effect.Effect<boolean>;
	/**
	 * Moves a folder with everything in it, rewriting no file's content, not
	 * even links to the moved notes; fails rather than merge.
	 */
	readonly moveFolder: (
		from: string,
		to: string,
	) => Effect.Effect<void, ResetFailed>;
	/** Creates a Markdown note; fails rather than overwrite one. */
	readonly createNote: (
		path: string,
		content: string,
	) => Effect.Effect<void, ResetFailed>;
};

/** The dictionary store and the Knowledge queue, as the reset uses them. */
export type ResetDictionary = {
	/** Reads `Worter/` again after the backup moved it through VAM. */
	readonly rescan: Effect.Effect<void, ResetFailed>;
	/**
	 * Places text as freeform: under a Reading note's Note title, or last in
	 * a Lemma note.
	 */
	readonly appendFreeform: (request: {
		readonly path: string;
		readonly text: string;
	}) => Effect.Effect<"Appended" | "AlreadyThere", ResetFailed>;
	/** Waits until no background Knowledge run is going. */
	readonly settleKnowledge: Effect.Effect<void>;
};
