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
 * - **The old name still taken.** When Obsidian opens another note outside
 *   `Worter/` for the old basename, and that note did not take the name in
 *   the same rename, the refs may be that note's: they stay, and the store
 *   logs it. If a later bulk shows that note taking the name, as when two
 *   Scrolls swap names in two bulks, the two renames settle as one
 *   (`DeferredRefs`). A note under `Worter/` owns no ref's name, so refs
 *   whose old name only a dictionary note has move.
 * - **A new name that shadows.** When Obsidian opens the renamed Scroll for
 *   a basename refs already named, and exactly one other note outside
 *   `Worter/` had that name, those refs move to that note's path, so they
 *   keep their Scroll.
 * - **Names ignore case,** as Obsidian matches link names: `tale` and
 *   `Tale` are one name, wherever names are compared.
 * - **From the note that holds it.** Obsidian resolves a link from the
 *   note it sits in: a note under that note's folder wins a basename
 *   before the shortest path does. So every name is resolved from the
 *   Reading note holding the ref (#210): a Lemma note `Mutter.md` beside
 *   `👩 Mutter.md` takes "Mutter" from it, wherever the Scroll is.
 *
 * Classify names a Scroll in a new ref by the same rule, from the Reading
 * note the ref goes in (`scrollRefNamesOf`), and matches a stored ref
 * that names the same occurrence by another spelling that opens the
 * Scroll from the note holding it (`storedRefFor`), so one occurrence
 * never has two refs (#198).
 * - **A ref already there.** A ref moves only where no ref stays, and no
 *   two refs move to one; the others stay, and the store logs them.
 * - **Idempotent.** A ref that already names the Scroll as it should stays,
 *   so a rename heard twice, or after Obsidian's own rewrite, writes once.
 *
 * Once the plugin was off while a Scroll moved, Obsidian's link updater may
 * have left Deine Kontexte showing a ref by its new name while the metadata
 * holds the old one (`ReadingNoteEntry.retargeted`). After a full read the
 * store adopts the new name for each such ref whose old name opens no note
 * and whose new one opens a note outside `Worter/` (`retargetForRepairs`),
 * each resolved from its own Reading note.
 *
 * A dictionary note that takes a Scroll's basename from refs beside it,
 * such as a Lemma note created in their Reading note's folder, breaks
 * them. The store moves each such ref to its Scroll's path when nothing
 * else could be its Scroll (`retargetForShadows`).
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
	VaultPath,
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

/** A stored ref and the Reading note holding it, which its name resolves from. */
export type HeldRef = { readonly ref: string; readonly from: string };

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

/**
 * The form two link names share when Obsidian takes them for one name: it
 * matches link names ignoring case, on every file system, so `tale` and
 * `Tale` name the same notes.
 */
const nameKey = (name: string) => VaultPath.caseInsensitive.key(name);

const samePath = VaultPath.caseSensitive.same;

/** The folder a note sits in: Obsidian resolves a link from a note by it alone. */
const folderOf = (path: string) => path.split("/").slice(0, -1).join("/");

/**
 * `lookup`, asking Obsidian once per name and folder: within one decision
 * the vault holds still, and every Reading note of a folder resolves a
 * name alike.
 */
function remembering<E>(lookup: ScrollLookup<E>): ScrollLookup<E> {
	const resolved = new Map<string, string | undefined>();
	const named = new Map<string, readonly string[]>();
	return {
		named: (basename) => {
			const known = named.get(basename);
			return known === undefined
				? lookup
						.named(basename)
						.pipe(
							Effect.tap((paths) =>
								Effect.sync(() => named.set(basename, paths)),
							),
						)
				: Effect.succeed(known);
		},
		resolve: (linkpath, from) => {
			const key = `${linkpath}\u0000${folderOf(from)}`;
			return resolved.has(key)
				? Effect.succeed(resolved.get(key))
				: lookup
						.resolve(linkpath, from)
						.pipe(
							Effect.tap((found) =>
								Effect.sync(() => resolved.set(key, found)),
							),
						);
		},
	};
}

/**
 * The link path a ref in the note at `from` names the note at `path` by:
 * its basename if Obsidian opens it for that name from there, else its path.
 */
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

/** A spelling stored refs name a Scroll by, and the Reading note it opens the Scroll from. */
export type ScrollAlias = {
	readonly linkpath: string;
	/** The Reading note holding refs of that spelling. */
	readonly from: string;
};

/** How Attestation Refs name one Scroll, for a new ref in one Reading note (#198, #210). */
export type ScrollRefNames = {
	/**
	 * The link path a new ref in that Reading note names the Scroll by, as
	 * the store's rename rewrite names it there.
	 */
	readonly linkpath: string;
	/**
	 * Every spelling of the Scroll's basename or path that stored refs use,
	 * with each Reading note holding them that Obsidian opens the Scroll
	 * for that spelling from.
	 */
	readonly aliases: readonly ScrollAlias[];
};

/**
 * Whether a note Obsidian does not know yet, such as a Lemma note the
 * commit creates, has the Scroll's basename. Such a note, beside the
 * Reading note, wins the name from it.
 */
const takenByUnseen = (scrollPath: string, unseen: readonly string[]) => {
	const name = nameKey(basenameOf(scrollPath));
	return unseen.some(
		(path) =>
			!samePath(path, scrollPath) && nameKey(basenameOf(path)) === name,
	);
};

/**
 * How refs name a Scroll when Obsidian cannot be asked: by its basename,
 * as Classify did before #198, unless a note of `unseen` has it.
 */
export const basenameRefNames = (
	scrollPath: string,
	unseen: readonly string[] = [],
): ScrollRefNames => ({
	aliases: [],
	linkpath: takenByUnseen(scrollPath, unseen)
		? linkpathOf(scrollPath)
		: basenameOf(scrollPath),
});

/**
 * How refs name the Scroll at `scrollPath` for a new ref in the Reading
 * note at `from`, given the `held` refs: its basename when Obsidian opens
 * the Scroll for it from that note, its path otherwise, the rule the
 * store's rename rewrite follows. `unseen` are notes the ref's commit may
 * create that Obsidian cannot see yet, the Reading's own Lemma and Reading
 * notes: one with the Scroll's basename takes the path form.
 */
export const scrollRefNamesOf = Effect.fnUntraced(function* <E>(
	scrollPath: string,
	from: string,
	held: readonly HeldRef[],
	asked: ScrollLookup<E>,
	unseen: readonly string[] = [],
): Effect.fn.Return<ScrollRefNames, E> {
	const lookup = remembering(asked);
	const linkpath = takenByUnseen(scrollPath, unseen)
		? linkpathOf(scrollPath)
		: yield* nameOf(scrollPath, from, lookup);
	const name = nameKey(basenameOf(scrollPath));
	const path = nameKey(linkpathOf(scrollPath));
	const aliases = new Map<string, ScrollAlias>();
	for (const { from: holder, ref } of held) {
		const parts = parseAttestationRef(ref);
		if (parts === undefined) continue;
		const key = nameKey(parts.linkpath);
		if (key !== name && key !== path) continue;
		const alias = `${parts.linkpath}\u0000${holder}`;
		if (aliases.has(alias)) continue;
		if ((yield* lookup.resolve(parts.linkpath, holder)) === scrollPath)
			aliases.set(alias, { from: holder, linkpath: parts.linkpath });
	}
	return {
		aliases: [...aliases]
			.sort(([left], [right]) => (left < right ? -1 : 1))
			.map(([, alias]) => alias),
		linkpath,
	};
});

/**
 * The stored ref of the occurrence `ref` names, when a stored ref names it
 * by one of the Scroll's `aliases` from the Reading note the alias holds:
 * the same block and occurrence key, the Scroll spelled another way that
 * opens it from the note the stored ref sits in. `ref` itself when the
 * dictionary holds it, or holds no such ref. Matching refs this way keeps
 * a second ref of one occurrence from being added beside the first (#198),
 * and never takes a ref that opens another note for the occurrence's (#210).
 */
export function storedRefFor(
	view: Pick<DictionaryView, "attestationLinksWithRef" | "readingLocation">,
	ref: string,
	aliases: readonly ScrollAlias[],
): string {
	const parts = parseAttestationRef(ref);
	if (parts === undefined || view.attestationLinksWithRef(ref).length > 0)
		return ref;
	for (const alias of aliases) {
		const stored = retargetedRef(parts, alias.linkpath);
		const holders = view
			.attestationLinksWithRef(stored)
			.map(({ reading }) => view.readingLocation(reading)?.path);
		if (holders.includes(alias.from)) return stored;
	}
	return ref;
}

/**
 * Refs a rename left because Obsidian opened another note, the `owner`,
 * for their old name (#199). If the owner turns out to have taken that
 * name in a rename the store hears later, as when two Scrolls swap names
 * in two bulk events, the refs were the renamed Scroll's after all: once
 * the store has heard that rename, and knows where the Scroll is, they
 * move to it.
 */
export type DeferredRefs = {
	/** The refs that stayed. */
	readonly refs: readonly string[];
	/** Their old name. */
	readonly name: string;
	/** The renamed Scroll's path, as the last rename heard left it. */
	readonly scroll: string;
	/** The note Obsidian opened for `name` instead, from `from`. */
	readonly owner: string;
	/** The Reading note holding the refs, which their names resolve from. */
	readonly from: string;
	/** Set once the store heard the owner take its name, while the Scroll had moved on unheard. */
	readonly ownerArrived?: true;
	/** When the rename left them, in milliseconds. */
	readonly at: number;
};

/** What `retargetForRenames` decided. */
export type RenameRetarget = {
	readonly retarget: Retarget | undefined;
	/** Which refs stay, and why. */
	readonly notes: string[];
	/** The deferrals still waiting: earlier ones these renames did not settle, and new ones. */
	readonly deferred: DeferredRefs[];
};

/**
 * Where the refs of these renames go, for the stored `refs` one Reading
 * note holds, resolved from that note, `from`. `deferred` are refs earlier
 * renames left in it; a rename here that gives their owner its name
 * settles them, as if both renames had come in one bulk. `retarget` is
 * undefined when no ref moves; new deferrals are stamped `now`.
 *
 * Names compare as Obsidian matches link names, ignoring case. Notes under
 * `Worter/` never count as a name's owner: refs never point into it.
 */
const retargetFromNote = Effect.fnUntraced(function* <E>(
	renames: readonly ScrollRename[],
	refs: readonly string[],
	from: string,
	lookup: ScrollLookup<E>,
	deferred: readonly DeferredRefs[] = [],
	now = 0,
): Effect.fn.Return<RenameRetarget, E> {
	const held = new Set<string>();
	/** The stored spellings of each name. */
	const spellings = new Map<string, Set<string>>();
	/** The stored refs naming each name. */
	const refsNamed = new Map<string, string[]>();
	for (const ref of refs) {
		const parts = parseAttestationRef(ref);
		if (parts === undefined) continue;
		held.add(parts.linkpath);
		const key = nameKey(parts.linkpath);
		const spelt = spellings.get(key) ?? new Set();
		spellings.set(key, spelt.add(parts.linkpath));
		const named = refsNamed.get(key) ?? [];
		named.push(ref);
		refsNamed.set(key, named);
	}
	const spelled = (name: string) => [...(spellings.get(nameKey(name)) ?? [])];

	const files = renames.filter(({ kind }) => kind === "File");
	const folders = renames.filter(
		({ from: folder, kind }) =>
			kind === "Folder" &&
			[...held].some((linkpath) => linkpath.startsWith(`${folder}/`)),
	);
	const renamed = (rename: ScrollRename) =>
		basenameOf(rename.from) !== basenameOf(rename.to);
	/** Whether a rename gave its note another name, not one that differs only in case. */
	const tookName = (rename: ScrollRename) =>
		nameKey(basenameOf(rename.from)) !== nameKey(basenameOf(rename.to));
	const notes: string[] = [];
	const byRef = new Map<string, string>();

	// Earlier deferrals whose owner took its name, in these renames or
	// before: the renames settle as one, as if they had come in one bulk.
	const waiting: DeferredRefs[] = [];
	const settled: DeferredRefs[] = [];
	for (const earlier of deferred) {
		// A rename that moves the owner away, before any rename showed it
		// taking the name, shows it had the name all along: the refs may
		// be its, and stay for good. Without this, another note renamed
		// onto the owner's old path would look like its arrival.
		if (
			earlier.ownerArrived !== true &&
			renames.some((rename) =>
				rename.kind === "File"
					? samePath(rename.from, earlier.owner)
					: isUnder(earlier.owner, rename.from),
			)
		) {
			notes.push(
				`Refs to ${earlier.name} stay: ${earlier.owner}, which Obsidian opened for that name, moved without taking it`,
			);
			continue;
		}
		const arrival = files.find(
			(rename) => tookName(rename) && samePath(rename.to, earlier.owner),
		);
		if (arrival === undefined && earlier.ownerArrived !== true) {
			waiting.push(earlier);
			continue;
		}
		const onward = files.find((rename) =>
			samePath(rename.from, earlier.scroll),
		);
		const scroll = onward?.to ?? earlier.scroll;
		if ((yield* lookup.resolve(linkpathOf(scroll), from)) !== scroll) {
			// The Scroll moved on in a rename not heard yet; that rename
			// places them.
			if (onward === undefined)
				waiting.push({ ...earlier, ownerArrived: true });
			else
				notes.push(
					`Refs to ${earlier.name} stay: Obsidian opens no note at ${scroll}, where their Scroll went`,
				);
			continue;
		}
		settled.push({ ...earlier, scroll });
		const target = yield* nameOf(scroll, from, lookup);
		for (const ref of earlier.refs) byRef.set(ref, target);
	}

	// Notes that took their basename in these renames; a note a folder
	// rename only moved, or one renamed only in case, keeps the one it had.
	const arrived = new Set([
		...files.filter(tookName).map(({ to }) => to),
		...settled.map(({ scroll }) => scroll),
	]);
	const hasArrived = (path: string) =>
		[...arrived].some((other) => samePath(other, path));
	const leaving = new Set([
		...files
			.filter(renamed)
			.map(({ from: path }) => nameKey(basenameOf(path))),
		...settled.map(({ name }) => nameKey(name)),
	]);
	/** The notes outside `Worter/` with this name, besides `but` and the notes that just took it. */
	const othersNamed = Effect.fnUntraced(function* (
		name: string,
		but: string,
	) {
		return (yield* lookup.named(name)).filter(
			(path) =>
				outsideDictionary(path) &&
				!samePath(path, but) &&
				!hasArrived(path),
		);
	});
	const byName = new Map<string, string>();
	const byPath = new Map<string, string>();
	const shadowed = new Map<string, string>();
	const fresh: DeferredRefs[] = [];
	for (const rename of files) {
		const oldName = basenameOf(rename.from);
		const newName = basenameOf(rename.to);
		const oldPath = linkpathOf(rename.from);
		// A note at the vault root has one name for both; it counts as a name.
		const byItsPath = oldPath !== oldName && held.has(oldPath);
		const named = spelled(oldName).length > 0 && renamed(rename);
		if (named || byItsPath) {
			const target = yield* nameOf(rename.to, from, lookup);
			if (byItsPath) byPath.set(oldPath, target);
			if (named) {
				const owner = yield* lookup.resolve(oldName, from);
				if (
					owner === undefined ||
					samePath(owner, rename.to) ||
					hasArrived(owner)
				)
					byName.set(nameKey(oldName), target);
				else if (outsideDictionary(owner)) {
					notes.push(
						`Refs to ${oldName} stay: Obsidian opens ${owner} for that name, and they may be its`,
					);
					fresh.push({
						at: now,
						from,
						name: oldName,
						owner,
						refs: refsNamed.get(nameKey(oldName)) ?? [],
						scroll: rename.to,
					});
				} else {
					// Obsidian opens a dictionary note for the name, which no
					// ref names; the refs are the Scroll's unless another
					// note outside the dictionary has the name.
					const others = yield* othersNamed(oldName, rename.to);
					if (others.length === 0)
						byName.set(nameKey(oldName), target);
					else
						notes.push(
							`Refs to ${oldName} stay: ${others.join(", ")} also ${others.length === 1 ? "has" : "have"} that name, and they may be ${others.length === 1 ? "its" : "theirs"}`,
						);
				}
			}
		}
		if (!renamed(rename) || leaving.has(nameKey(newName))) continue;
		// Each spelling of the new name that now opens the renamed Scroll
		// opened the one other note of that name before.
		const shadowing: string[] = [];
		for (const spelling of spelled(newName))
			if ((yield* lookup.resolve(spelling, from)) === rename.to)
				shadowing.push(spelling);
		if (shadowing.length === 0) continue;
		const others = yield* othersNamed(newName, rename.to);
		const [other] = others;
		if (others.length === 1 && other !== undefined)
			for (const spelling of shadowing)
				shadowed.set(spelling, linkpathOf(other));
		else if (others.length > 1)
			notes.push(
				`Refs to ${newName} stay: ${rename.to} took that name, and ${others.length} other notes share it`,
			);
	}
	if (
		byRef.size + byName.size + byPath.size + shadowed.size === 0 &&
		folders.length === 0
	)
		return { deferred: [...waiting, ...fresh], notes, retarget: undefined };
	const retarget: Retarget = ({ linkpath }, ref) => {
		const named =
			byRef.get(ref) ??
			byPath.get(linkpath) ??
			byName.get(nameKey(linkpath)) ??
			shadowed.get(linkpath);
		if (named !== undefined) return named;
		for (const folder of folders)
			if (linkpath.startsWith(`${folder.from}/`))
				return `${folder.to}${linkpath.slice(folder.from.length)}`;
		return undefined;
	};
	return { deferred: [...waiting, ...fresh], notes, retarget };
});

/**
 * Where the refs of these renames go, for every stored ref with the
 * Reading note holding it (#210): each note's refs are placed by
 * `retargetFromNote`, resolved from that note, with the deferrals its refs
 * left. A deferral whose note holds no ref any more is dropped, and its
 * refs, if they moved elsewhere, stay.
 */
export const retargetForRenames = Effect.fnUntraced(function* <E>(
	renames: readonly ScrollRename[],
	held: readonly HeldRef[],
	asked: ScrollLookup<E>,
	deferred: readonly DeferredRefs[] = [],
	now = 0,
): Effect.fn.Return<RenameRetarget, E> {
	const lookup = remembering(asked);
	const byNote = new Map<string, string[]>();
	for (const { from, ref } of held) {
		const refs = byNote.get(from) ?? [];
		refs.push(ref);
		byNote.set(from, refs);
	}
	const notes = new Set<string>();
	const waiting: DeferredRefs[] = [];
	const byRef = new Map<string, Retarget>();
	for (const [from, refs] of byNote) {
		const placed = yield* retargetFromNote(
			renames,
			refs,
			from,
			lookup,
			deferred.filter((earlier) => earlier.from === from),
			now,
		);
		for (const note of placed.notes) notes.add(note);
		waiting.push(...placed.deferred);
		const { retarget } = placed;
		if (retarget !== undefined)
			for (const ref of refs) byRef.set(ref, retarget);
	}
	return {
		deferred: waiting,
		notes: [...notes],
		retarget:
			byRef.size === 0
				? undefined
				: (parts, ref) => byRef.get(ref)?.(parts, ref),
	};
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

/** The form a note's basename is matched by in a link, ignoring case. */
export const basenameKeyOf = (path: string): string =>
	nameKey(basenameOf(path));

/** A block ID at a line's end, after whitespace, as Obsidian reads one. */
const BLOCK_ID = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/u;
/** A line that starts a block of its own: a list item, a heading or a quote. */
const OPENS_BLOCK = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>)/u;
/** A line no block runs across. */
const BREAKS_BLOCK = /^\s*(?:$|```|~~~|\|)/u;
const WIKILINK = /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/gu;

/**
 * Whether `content` holds the block `^blockId` exactly once, and that
 * block links the note at `linked`: the link Classify writes at an
 * occurrence goes to its Reading note (#64).
 */
function blockLinks(content: string, blockId: string, linked: string): boolean {
	const lines = content.split("\n").map((line) => line.replace(/\r$/u, ""));
	const ends = lines.flatMap((line, at) =>
		BLOCK_ID.exec(line)?.[1] === blockId ? [at] : [],
	);
	const [end] = ends;
	if (ends.length !== 1 || end === undefined) return false;
	let start = end;
	while (start > 0 && !OPENS_BLOCK.test(lines[start] ?? "")) {
		const previous = lines[start - 1] ?? "";
		if (BREAKS_BLOCK.test(previous) || BLOCK_ID.test(previous)) break;
		start -= 1;
	}
	const target = nameKey(linkpathOf(linked));
	return lines
		.slice(start, end + 1)
		.some((line) =>
			[...line.matchAll(WIKILINK)].some(
				([, linkpath]) => nameKey(linkpath ?? "") === target,
			),
		);
}

/**
 * Where refs go whose basename a dictionary note took from their Scroll
 * (#210): a Lemma note created beside their Reading note, a Crossroad note
 * whose path is shorter than the Scroll's, or a ref written that way
 * before refs were named from their own Reading note. Refs never point
 * into `Worter/`, so such a ref is broken, and it moves to the Scroll's
 * path only when nothing else could be its Scroll:
 *
 * - its link path is a basename, and from its Reading note Obsidian opens
 *   a note under `Worter/` for it;
 * - exactly one note outside `Worter/` has that basename;
 * - that note holds the ref's block once, and the block links the ref's
 *   Reading note, as Classify linked the occurrence;
 * - no other Reading note holds the same ref.
 *
 * The occurrence key is a hash of the segmenter's Sentence and Segments,
 * which the store cannot recompute; `planRefRewrite` still refuses a move
 * onto a ref the dictionary holds. Every other ref stays as it is. `names`
 * limits it to refs naming those basenames, by `basenameKeyOf`.
 */
export const retargetForShadows = Effect.fnUntraced(function* <E>(
	held: readonly HeldRef[],
	asked: ScrollLookup<E>,
	read: (path: string) => Effect.Effect<string | undefined, E>,
	names?: ReadonlySet<string>,
): Effect.fn.Return<Retarget | undefined, E> {
	const lookup = remembering(asked);
	const holders = new Map<string, number>();
	for (const { ref } of held) holders.set(ref, (holders.get(ref) ?? 0) + 1);
	const contents = new Map<string, string | undefined>();
	const byRef = new Map<string, string>();
	for (const { from, ref } of held) {
		const parts = parseAttestationRef(ref);
		if (parts === undefined || parts.linkpath.includes("/")) continue;
		if (names !== undefined && !names.has(nameKey(parts.linkpath)))
			continue;
		if (holders.get(ref) !== 1) continue;
		const opened = yield* lookup.resolve(parts.linkpath, from);
		if (opened === undefined || outsideDictionary(opened)) continue;
		const outside = (yield* lookup.named(parts.linkpath)).filter(
			outsideDictionary,
		);
		const [scroll] = outside;
		if (outside.length !== 1 || scroll === undefined) continue;
		if (!contents.has(scroll)) contents.set(scroll, yield* read(scroll));
		const content = contents.get(scroll);
		if (content === undefined || !blockLinks(content, parts.blockId, from))
			continue;
		byRef.set(ref, yield* nameOf(scroll, from, lookup));
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
