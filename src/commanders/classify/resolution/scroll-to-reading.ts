/**
 * A click on a link to a Reading whose Knowledge is still being generated
 * (#64, #116). Obsidian opens the Reading note on the click, as it is so
 * far; once the Knowledge lands, the note is opened again, unless it is
 * already the active note, which then shows it as it is. Only the latest
 * clicked link reopens its note, so a user who clicked on elsewhere is
 * pulled back to nothing older.
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
	/** Opens the note at a vault path in the active leaf. */
	readonly open: (path: string) => Effect.Effect<void, E>;
};

/**
 * Answers a clicked link: once the Knowledge of the note it points at
 * lands, the note opens again. It answers whether it reopened the note.
 */
export function createReadingReopener<E>(
	deps: ReadingReopenerDeps<E>,
): (target: string) => Effect.Effect<boolean, E> {
	let latest = 0;
	return Effect.fn("ReadingReopener.reopen")(function* (target: string) {
		const click = ++latest;
		const waited = yield* awaitReadingKnowledge(deps.queue, target);
		if (!waited || click !== latest) return false;
		const path = notePathOf(linkTargetPath(target));
		const active = yield* deps.activePath;
		if (active !== null && VaultPath.caseSensitive.same(active, path))
			return false;
		yield* deps.open(path);
		return true;
	});
}
