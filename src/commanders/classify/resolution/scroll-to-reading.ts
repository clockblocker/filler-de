/**
 * A click on a link to a Reading whose Knowledge is still being generated
 * (#64): Obsidian opens the Reading note on the click, and this waits for
 * the run, so the caller can tell the note is still being written.
 * TODO(#116): open the Reading note again once its Knowledge lands.
 */
import type { KnowledgeQueue } from "./knowledge-queue";

/** `Worter/…/🌊 See|See` or `Worter/…/See#^r-1a2b|See` → its note path. */
function linkTargetPath(target: string): string {
	const [beforeAlias = ""] = target.split("|");
	const hash = beforeAlias.indexOf("#");
	return (hash < 0 ? beforeAlias : beforeAlias.slice(0, hash)).trim();
}

/** What a click on a wikilink starts: wait for the note's Knowledge, if any runs. */
export function awaitReadingKnowledge(
	queue: Pick<KnowledgeQueue, "awaitNote">,
	target: string,
): Promise<boolean> {
	const path = linkTargetPath(target);
	if (!path.startsWith("Worter/")) return Promise.resolve(false);
	return queue.awaitNote(path);
}
