/**
 * Scroll to entry (#64): a click on a link to a Reading whose Knowledge is
 * still being generated waits for that run, then scrolls the opened note
 * to the Reading's block, which the run's rewrite may have moved.
 * Obsidian itself scrolls to `#^r-…` on the click; this only corrects for
 * the note changing under it.
 */
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { splitPathCodec } from "@textfresser/vault-action-manager";
import { Effect, Option } from "effect";
import { blockIdHelper } from "../../../stateless-helpers/block-id";
import type { KnowledgeQueue } from "./knowledge-queue";

/** `Worter/…/See#^r-1a2b|See` → its note path and block ID. */
function parseReadingLinkTarget(target: string): {
	readonly path: string;
	readonly blockId?: string;
} {
	const [beforeAlias = ""] = target.split("|");
	const hash = beforeAlias.indexOf("#");
	const path = (hash < 0 ? beforeAlias : beforeAlias.slice(0, hash)).trim();
	const subpath = hash < 0 ? "" : beforeAlias.slice(hash + 1);
	return subpath.startsWith("^")
		? { blockId: subpath.slice(1), path }
		: { path };
}

const withMd = (path: string) => (path.endsWith(".md") ? path : `${path}.md`);

const scrollOpenedNoteToBlock = Effect.fnUntraced(function* (
	vam: Pick<
		VaultActionManager,
		"getActiveEditorContext" | "scrollOpenedFileToLine"
	>,
	lemmaPath: string,
	blockId: string,
) {
	const active = yield* vam
		.getActiveEditorContext()
		.pipe(Effect.option, Effect.map(Option.flatMap(Option.fromNullishOr)));
	if (Option.isNone(active)) return;
	if (splitPathCodec.format(active.value.splitPath) !== withMd(lemmaPath))
		return;
	const line = active.value.content
		.split("\n")
		.findIndex((text) => blockIdHelper.extractFromLine(text) === blockId);
	if (line < 0) return;
	yield* vam.scrollOpenedFileToLine(line).pipe(Effect.ignore);
});

/** What a click on a wikilink starts: wait for the note's Knowledge, then scroll. */
export function scrollAfterKnowledge(
	queue: Pick<KnowledgeQueue, "awaitNote">,
	vam: Pick<
		VaultActionManager,
		"getActiveEditorContext" | "scrollOpenedFileToLine"
	>,
	target: string,
): Promise<void> {
	const { blockId, path } = parseReadingLinkTarget(target);
	if (!path.startsWith("Worter/")) return Promise.resolve();
	return queue.awaitNote(path).then((awaited) => {
		const block = blockId ?? awaited;
		if (awaited === undefined || block === undefined) return;
		return Effect.runPromise(scrollOpenedNoteToBlock(vam, path, block));
	});
}
