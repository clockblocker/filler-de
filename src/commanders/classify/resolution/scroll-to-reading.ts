/**
 * A click on a link to a Reading whose Knowledge is still being generated
 * (#64, #116), as every first click on a Reading's link starts it (#284).
 * Obsidian opens the Reading note on the click, as it is so far; once the
 * Knowledge lands, the note shows it, in place, only while it is still the
 * active note. A user who went back to the Scroll, or anywhere else, is
 * never pulled into the note: leaving it ends the wait. Only the latest
 * clicked link counts.
 */
import { WORTER_FOLDER } from "@textfresser/lemma-note-codec";
import { VaultPath } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { KnowledgeQueue } from "./knowledge-queue";

/** `Worter/…/🌊 See|See` or `Worter/…/See#^r-1a2b|See` → its note path. */
function linkTargetPath(target: string): string {
	const [beforeAlias = ""] = target.split("|");
	const hash = beforeAlias.indexOf("#");
	return (hash < 0 ? beforeAlias : beforeAlias.slice(0, hash)).trim();
}

const notePathOf = (path: string) =>
	path.endsWith(".md") ? path : `${path}.md`;

/** What a click on a wikilink starts: wait for the note's Knowledge, if any runs. */
function awaitReadingKnowledge(
	queue: Pick<KnowledgeQueue, "awaitNote">,
	target: string,
): Effect.Effect<boolean> {
	const path = linkTargetPath(target);
	if (
		!VaultPath.caseSensitive.isUnder(path, WORTER_FOLDER, {
			inclusive: false,
		})
	)
		return Effect.succeed(false);
	return queue.awaitNote(path);
}

export type ReadingReopenerDeps<E> = {
	readonly queue: Pick<KnowledgeQueue, "awaitNote">;
	/** The active note's vault path, if a Markdown note is active. */
	readonly activePath: Effect.Effect<string | null>;
	/**
	 * Ends once the note at `path` is no longer the active one: the user
	 * opened another note, or another pane took the focus. It ends at once
	 * when the note is not active now.
	 */
	readonly leaves: (path: string) => Effect.Effect<void>;
	/**
	 * Makes the active note at `path` show its content as it is now, in
	 * place, keeping where it is scrolled to.
	 */
	readonly refresh: (path: string) => Effect.Effect<void, E>;
};

/**
 * Answers a clicked link once the Knowledge of the note it points at
 * lands: the note shows it, if it is still the active note. A user who
 * opened another note meanwhile, or clicked another link, is left where
 * they are, and their navigation ends the wait. It answers whether it
 * refreshed the note.
 */
export function createReadingReopener<E>(
	deps: ReadingReopenerDeps<E>,
): (target: string) => Effect.Effect<boolean, E> {
	let latest = 0;
	return Effect.fn("ReadingReopener.reopen")(function* (target: string) {
		const click = ++latest;
		const path = notePathOf(linkTargetPath(target));
		const landed = yield* Effect.raceFirst(
			awaitReadingKnowledge(deps.queue, target),
			deps.leaves(path).pipe(Effect.as(false)),
		);
		if (!landed || click !== latest) return false;
		const active = yield* deps.activePath;
		if (active === null || !VaultPath.caseSensitive.same(active, path))
			return false;
		yield* deps.refresh(path);
		return true;
	});
}
