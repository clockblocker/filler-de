/**
 * Refs into a Scroll that moved (#99). A Reading note names the place of an
 * occurrence by an Attestation Ref, `![[Story#^0|^1a2b3c4d]]`, which names
 * its Scroll by basename, or by vault path without `.md` where another note
 * shares the basename. The refs live in metadata, where Obsidian's link
 * updater cannot see them, so the store rewrites them itself when it hears
 * a Scroll was renamed, whoever renamed it: the user, the Librarian's
 * healing or a delimiter change.
 *
 * Deciding where a ref goes asks Obsidian how it resolves names, so it
 * happens before the store's transaction; the plan inside it is a pure
 * function of the index (`planRefRewrite`).
 *
 * - **A renamed Scroll.** Refs naming its old basename, or its old path,
 *   move to its new name: its basename when Obsidian opens it for that
 *   name, its path otherwise, as Obsidian's "shortest path" link format.
 * - **A folder rename** moves nothing a basename names. Refs naming a path
 *   under it follow it.
 * - **The old name still taken.** When Obsidian opens another note for the
 *   old basename, and that note did not take the name in the same rename,
 *   the refs may be that note's: they stay, and the store logs it.
 * - **A new name that shadows.** When Obsidian opens the renamed Scroll for
 *   a basename refs already named, and exactly one other note had that
 *   name, those refs move to that note's path, so they keep their Scroll.
 * - **A ref already there.** A ref moves only where no ref stays, and no
 *   two refs move to one; the others stay, and the store logs them.
 * - **Idempotent.** A ref that already names the Scroll as it should stays,
 *   so a rename heard twice, or after Obsidian's own rewrite, writes once.
 *
 * Once the plugin was off while a Scroll moved, Obsidian's link updater may
 * have left Deine Kontexte showing a ref by its new name while the metadata
 * holds the old one (`ReadingNoteEntry.retargeted`). After a full read the
 * store adopts the new name for each such ref whose old name opens no note
 * and whose new one opens a note outside `Worter/` (`retargetForRepairs`).
 */
import {
	ATTESTATION_REF_START,
	type AttestationRefParts,
	parseAttestationRef,
	retargetedRef,
	WORTER_FOLDER,
} from "@textfresser/lemma-note-codec";
import {
	type BulkVaultEvent,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import type { PlannedChangeOp } from "dumdict";
import type * as Dumling from "dumling/types";
import { Effect } from "effect";
import { readingKeyOf } from "./keys";
import { Transaction } from "./transaction";
import { formatPath, isUnder } from "./vault";
import type { DictionaryView } from "./view";

/** A Markdown note or a folder renamed outside `Worter/`, by vault path. */
export type ScrollRename = {
	readonly kind: "File" | "Folder";
	readonly from: string;
	readonly to: string;
};

/** What a ref rewrite did. */
export type RefRewrite = {
	readonly rewritten: number;
	/** Refs that stayed, and why. */
	readonly kept: readonly { readonly ref: string; readonly reason: string }[];
};

/** A stored ref's new link path, if it moves. */
export type Retarget = (
	parts: AttestationRefParts,
	ref: string,
) => string | undefined;

/** How Obsidian resolves names, as the store asks VAM. */
export type ScrollLookup<E> = {
	/** The Markdown note Obsidian opens for `linkpath` from the note at `from`. */
	readonly resolve: (
		linkpath: string,
		from: string,
	) => Effect.Effect<string | undefined, E>;
	/** Every Markdown note with this basename. */
	readonly named: (basename: string) => Effect.Effect<readonly string[], E>;
};

/** Whether a path is neither `Worter/` nor below it. */
const outsideDictionary = (path: string) => !isUnder(path, WORTER_FOLDER);

/**
 * The renames in a bulk event that may move refs: Markdown notes and
 * folders renamed outside `Worter/`, descendants of a folder rename
 * included, each chain of one note's renames as one.
 */
export function scrollRenamesOf(event: BulkVaultEvent): ScrollRename[] {
	const renames: ScrollRename[] = [];
	for (const vaultEvent of event.events) {
		if (vaultEvent.kind === VaultEventKind.FileRenamed) {
			if (
				vaultEvent.from.kind !== "MdFile" ||
				vaultEvent.to.kind !== "MdFile"
			)
				continue;
			const from = formatPath(vaultEvent.from);
			const to = formatPath(vaultEvent.to);
			if (!(outsideDictionary(from) && outsideDictionary(to))) continue;
			// VAM collapses a chain of renames; a chain left in a bulk is one.
			const earlier = renames.findIndex(
				(rename) => rename.kind === "File" && rename.to === from,
			);
			const start = renames[earlier];
			if (start === undefined) renames.push({ from, kind: "File", to });
			else if (start.from === to) renames.splice(earlier, 1);
			else renames[earlier] = { ...start, to };
		}
		if (vaultEvent.kind === VaultEventKind.FolderRenamed) {
			const from = formatPath(vaultEvent.from);
			const to = formatPath(vaultEvent.to);
			if (outsideDictionary(from) && outsideDictionary(to))
				renames.push({ from, kind: "Folder", to });
		}
	}
	return renames;
}

const basenameOf = (path: string) =>
	(path.split("/").at(-1) ?? path).replace(/\.md$/u, "");

/** A note's path as a ref names it: without `.md`. */
const linkpathOf = (path: string) => path.replace(/\.md$/u, "");

/** The link path a ref names the note at `path` by: its basename if that opens it, else its path. */
const nameOf = Effect.fnUntraced(function* <E>(
	path: string,
	from: string,
	lookup: ScrollLookup<E>,
) {
	const name = basenameOf(path);
	return (yield* lookup.resolve(name, from)) === path
		? name
		: linkpathOf(path);
});

/**
 * Where the refs of these renames go, for refs whose link paths are
 * `held`, resolved from the dictionary note at `from`. Undefined when no
 * ref moves; `notes` says which refs stay and why.
 */
export const retargetForRenames = Effect.fnUntraced(function* <E>(
	renames: readonly ScrollRename[],
	held: ReadonlySet<string>,
	from: string,
	lookup: ScrollLookup<E>,
): Effect.fn.Return<
	{ readonly retarget: Retarget | undefined; readonly notes: string[] },
	E
> {
	const files = renames.filter(({ kind }) => kind === "File");
	const folders = renames.filter(
		({ from: folder, kind }) =>
			kind === "Folder" &&
			[...held].some((linkpath) => linkpath.startsWith(`${folder}/`)),
	);
	const renamed = (rename: ScrollRename) =>
		basenameOf(rename.from) !== basenameOf(rename.to);
	// Notes that took their basename in these renames; a note a folder
	// rename only moved keeps the one it had.
	const arrived = new Set(files.filter(renamed).map(({ to }) => to));
	const leaving = new Set(
		files.filter(renamed).map(({ from: path }) => basenameOf(path)),
	);
	const byName = new Map<string, string>();
	const byPath = new Map<string, string>();
	const shadowed = new Map<string, string>();
	const notes: string[] = [];
	for (const rename of files) {
		const oldName = basenameOf(rename.from);
		const newName = basenameOf(rename.to);
		const oldPath = linkpathOf(rename.from);
		// A note at the vault root has one name for both; it counts as a name.
		const byItsPath = oldPath !== oldName && held.has(oldPath);
		const named = held.has(oldName) && renamed(rename);
		if (named || byItsPath) {
			const target = yield* nameOf(rename.to, from, lookup);
			if (byItsPath) byPath.set(oldPath, target);
			if (named) {
				const owner = yield* lookup.resolve(oldName, from);
				if (owner === undefined || arrived.has(owner))
					byName.set(oldName, target);
				else
					notes.push(
						`Refs to ${oldName} stay: Obsidian opens ${owner} for that name, and they may be its`,
					);
			}
		}
		if (!renamed(rename) || !held.has(newName) || leaving.has(newName))
			continue;
		if ((yield* lookup.resolve(newName, from)) !== rename.to) continue;
		const others = (yield* lookup.named(newName)).filter(
			(path) => path !== rename.to && !arrived.has(path),
		);
		const [other] = others;
		if (others.length === 1 && other !== undefined)
			shadowed.set(newName, linkpathOf(other));
		else if (others.length > 1)
			notes.push(
				`Refs to ${newName} stay: ${rename.to} took that name, and ${others.length} other notes share it`,
			);
	}
	if (byName.size + byPath.size + shadowed.size === 0 && folders.length === 0)
		return { notes, retarget: undefined };
	const retarget: Retarget = ({ linkpath }) => {
		const named =
			byPath.get(linkpath) ??
			byName.get(linkpath) ??
			shadowed.get(linkpath);
		if (named !== undefined) return named;
		for (const folder of folders)
			if (linkpath.startsWith(`${folder.from}/`))
				return `${folder.to}${linkpath.slice(folder.from.length)}`;
		return undefined;
	};
	return { notes, retarget };
});

/**
 * Where the refs Obsidian retargeted while the plugin was off go: the
 * note their new link path opens, named as `nameOf` names it, for each
 * ref whose stored link path opens no note. Each comes with the Reading
 * note it was read in, which a relative link path resolves from.
 */
export const retargetForRepairs = Effect.fnUntraced(function* <E>(
	retargeted: readonly {
		readonly ref: string;
		readonly linkpath: string;
		readonly from: string;
	}[],
	lookup: ScrollLookup<E>,
): Effect.fn.Return<Retarget | undefined, E> {
	const byRef = new Map<string, string>();
	for (const { from, linkpath, ref } of retargeted) {
		const parts = parseAttestationRef(ref);
		if (!parts || byRef.has(ref)) continue;
		if ((yield* lookup.resolve(parts.linkpath, from)) !== undefined)
			continue;
		const now = yield* lookup.resolve(linkpath, from);
		if (now === undefined || !outsideDictionary(now)) continue;
		byRef.set(ref, yield* nameOf(now, from, lookup));
	}
	if (byRef.size === 0) return undefined;
	return (_parts, ref) => byRef.get(ref);
});

/**
 * Plans moving every stored ref `retarget` moves, in one commit. A
 * Reading's links keep their order: from its first moved link on, its
 * links are removed, then added back, moved, after every removal, so refs
 * may trade names. A ref moves only where no ref stays and no other ref
 * moves; one that cannot stays and is reported.
 */
export function planRefRewrite(
	view: DictionaryView,
	retarget: Retarget,
): Transaction<RefRewrite> {
	const links = view.attestationLinksWithRefPrefix(ATTESTATION_REF_START);
	const held = new Set(links.map(({ ref }) => ref));
	const moves = new Map<string, string>();
	for (const { ref } of links) {
		const parts = parseAttestationRef(ref);
		if (!parts || moves.has(ref)) continue;
		const linkpath = retarget(parts, ref);
		if (linkpath !== undefined && linkpath !== parts.linkpath)
			moves.set(ref, retargetedRef(parts, linkpath));
	}
	const kept: { ref: string; reason: string }[] = [];
	for (let settled = false; !settled; ) {
		settled = true;
		const arriving = new Set<string>();
		for (const [from, to] of moves) {
			if ((held.has(to) && !moves.has(to)) || arriving.has(to)) {
				moves.delete(from);
				kept.push({
					reason: `${to} is already in the dictionary`,
					ref: from,
				});
				settled = false;
				break;
			}
			arriving.add(to);
		}
	}
	if (moves.size === 0) return Transaction.stop({ kept, rewritten: 0 });

	const readings = new Map<string, Dumling.Reading<"de">>();
	for (const { reading, ref } of links)
		if (moves.has(ref)) readings.set(readingKeyOf(reading), reading);
	const removals: PlannedChangeOp<"de">[] = [];
	const additions: PlannedChangeOp<"de">[] = [];
	for (const [key, reading] of readings) {
		const entry = view
			.lemmaNote(reading.lemma)
			?.readings.find((stored) => readingKeyOf(stored.reading) === key);
		const first =
			entry?.attestationLinks.findIndex(({ ref }) => moves.has(ref)) ??
			-1;
		if (entry === undefined || first < 0) continue;
		const tail = entry.attestationLinks.slice(first);
		removals.push({
			ops: tail.map((link) => ({ kind: "removeAttestationLink", link })),
			preconditions: [],
			reading,
			type: "patchReading",
		});
		additions.push({
			ops: tail.map((link) => ({
				kind: "addAttestationLink",
				link: { ...link, ref: moves.get(link.ref) ?? link.ref },
			})),
			preconditions: [],
			reading,
			type: "patchReading",
		});
	}
	return Transaction.commit(
		{ baseRevision: view.revision, changes: [...removals, ...additions] },
		{ kept, rewritten: moves.size },
	);
}
