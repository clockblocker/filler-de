/**
 * An in-memory Obsidian vault for tests that run the real Vault Action
 * Manager over it.
 */
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";

type Callback = (...args: never[]) => void;

/**
 * How the vault's `FileManager.renameFile` imitates Obsidian's link updater:
 *
 * - `alwaysUpdateLinks`: the "Automatically update internal links" setting.
 *   Off, the rename asks, and `answer` is the user's choice.
 * - `afterRewrite`: runs after the updater rewrote its files, before
 *   `renameFile` resolves.
 */
export type ObsidianVaultLinkOptions = {
	alwaysUpdateLinks?: boolean;
	answer?: "update" | "decline";
	afterRewrite?: () => void;
};

/**
 * An in-memory Obsidian vault holding `initial` (path to content). Renaming a
 * folder reports a rename for the folder and then for every descendant, and
 * trashing a folder reports a delete for it and every descendant, as
 * Obsidian does.
 *
 * `linkTo` records a resolved link, as `MetadataCache.resolvedLinks` holds
 * it. `FileManager.renameFile` then rewrites each file linking to the moved
 * file, or to a file below the moved folder, by appending the new path, and
 * each file in `unpredicted` as well, as the link updater rewrites a link
 * the rename made ambiguous.
 */
export function makeObsidianVault(
	initial: Record<string, string>,
	links: ObsidianVaultLinkOptions = {},
) {
	const resolvedLinks: Record<string, Record<string, number>> = {};
	const unpredicted = new Set<string>();
	const callbacks = new Map<string, Callback[]>();
	const byPath = new Map<string, TAbstractFile>();
	const contents = new Map<string, string>();
	const trashed: string[] = [];
	const fire = (name: string, ...args: unknown[]) => {
		for (const callback of callbacks.get(name) ?? []) {
			callback(...(args as never[]));
		}
	};

	const root = new TFolder();
	root.path = "/";
	root.name = "";
	root.children = [];
	const parentOf = (path: string): TFolder => {
		const parentPath = path.split("/").slice(0, -1).join("/");
		if (parentPath === "") return root;
		const parent = byPath.get(parentPath);
		if (!(parent instanceof TFolder)) {
			throw new Error(`no folder ${parentPath}`);
		}
		return parent;
	};
	const attach = (entry: TAbstractFile, path: string) => {
		entry.path = path;
		entry.name = path.split("/").at(-1) ?? path;
		if (entry instanceof TFile) {
			const dot = entry.name.lastIndexOf(".");
			entry.extension = entry.name.slice(dot + 1);
			entry.basename = entry.name.slice(0, dot);
		}
		const parent = parentOf(path);
		entry.parent = parent;
		parent.children.push(entry);
		byPath.set(path, entry);
	};
	const detach = (entry: TAbstractFile) => {
		const parent = entry.parent;
		if (parent) {
			parent.children = parent.children.filter((c) => c !== entry);
		}
		byPath.delete(entry.path);
	};
	const makeFolder = (path: string) => {
		const folder = new TFolder();
		folder.children = [];
		attach(folder, path);
		return folder;
	};
	const makeFile = (path: string, content: string) => {
		const file = new TFile();
		file.stat = { ctime: 1, mtime: 1, size: content.length };
		attach(file, path);
		contents.set(path, content);
		return file;
	};
	for (const [path, content] of Object.entries(initial)) {
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) {
			const folderPath = parts.slice(0, i).join("/");
			if (!byPath.has(folderPath)) makeFolder(folderPath);
		}
		makeFile(path, content);
	}

	const descendants = (folder: TFolder): TAbstractFile[] =>
		folder.children.flatMap((c) =>
			c instanceof TFolder ? [c, ...descendants(c)] : [c],
		);
	const rename = async (entry: TAbstractFile, toPath: string) => {
		if (byPath.has(toPath)) throw new Error(`exists ${toPath}`);
		const fromPath = entry.path;
		const moved = entry instanceof TFolder ? descendants(entry) : [];
		const movedContent = contents.get(fromPath);
		detach(entry);
		attach(entry, toPath);
		if (movedContent !== undefined) {
			contents.delete(fromPath);
			contents.set(toPath, movedContent);
		}
		const reported: [TAbstractFile, string][] = [[entry, fromPath]];
		for (const descendant of moved) {
			const oldPath = descendant.path;
			byPath.delete(oldPath);
			descendant.path = `${toPath}${oldPath.slice(fromPath.length)}`;
			byPath.set(descendant.path, descendant);
			const content = contents.get(oldPath);
			if (content !== undefined) {
				contents.delete(oldPath);
				contents.set(descendant.path, content);
			}
			reported.push([descendant, oldPath]);
		}
		for (const [e, oldPath] of reported) fire("rename", e, oldPath);
	};
	const write = (file: TFile, content: string) => {
		contents.set(file.path, content);
		file.stat = {
			...file.stat,
			mtime: file.stat.mtime + 1,
			size: content.length,
		};
		fire("modify", file);
	};

	const linksTo = (destinations: Record<string, number>, target: string) =>
		Object.keys(destinations).some(
			(destination) =>
				destination === target || destination.startsWith(`${target}/`),
		);
	const renameFile = async (entry: TAbstractFile, toPath: string) => {
		const fromPath = entry.path;
		const linking = Object.entries(resolvedLinks)
			.filter(([, destinations]) => linksTo(destinations, fromPath))
			.map(([source]) => source);
		await rename(entry, toPath);
		const moved = (path: string) =>
			path === fromPath || path.startsWith(`${fromPath}/`)
				? `${toPath}${path.slice(fromPath.length)}`
				: path;
		for (const destinations of Object.values(resolvedLinks))
			for (const destination of Object.keys(destinations)) {
				const now = moved(destination);
				if (now === destination) continue;
				destinations[now] = destinations[destination] ?? 1;
				delete destinations[destination];
			}
		for (const source of Object.keys(resolvedLinks)) {
			const now = moved(source);
			if (now === source) continue;
			resolvedLinks[now] = resolvedLinks[source] ?? {};
			delete resolvedLinks[source];
		}
		if (links.alwaysUpdateLinks === false && links.answer !== "update")
			return;
		for (const path of new Set([...linking.map(moved), ...unpredicted])) {
			const file = byPath.get(path);
			if (file instanceof TFile)
				write(file, `${contents.get(path) ?? ""} [[${toPath}]]`);
		}
		links.afterRewrite?.();
	};

	const app = {
		fileManager: {
			renameFile,
			trashFile: async (entry: TAbstractFile) => {
				trashed.push(entry.path);
				const gone =
					entry instanceof TFolder
						? [entry, ...descendants(entry)]
						: [entry];
				detach(entry);
				for (const g of gone) {
					byPath.delete(g.path);
					contents.delete(g.path);
				}
				for (const g of gone) fire("delete", g);
			},
		},
		metadataCache: { getFirstLinkpathDest: () => null, resolvedLinks },
		vault: {
			create: async (path: string, content: string) => {
				if (byPath.has(path)) throw new Error(`exists ${path}`);
				const file = makeFile(path, content);
				fire("create", file);
				return file;
			},
			createFolder: async (path: string) => {
				if (byPath.has(path)) throw new Error(`exists ${path}`);
				const folder = makeFolder(path);
				fire("create", folder);
				return folder;
			},
			getAbstractFileByPath: (path: string) => byPath.get(path) ?? null,
			getConfig: (key: string) =>
				key === "alwaysUpdateLinks"
					? (links.alwaysUpdateLinks ?? true)
					: undefined,
			getMarkdownFiles: () =>
				[...byPath.values()].filter(
					(f): f is TFile =>
						f instanceof TFile && f.extension === "md",
				),
			getRoot: () => root,
			modify: async (file: TFile, content: string) =>
				write(file, content),
			offref: (ref: { name: string; callback: Callback }) => {
				callbacks.set(
					ref.name,
					(callbacks.get(ref.name) ?? []).filter(
						(c) => c !== ref.callback,
					),
				);
			},
			on: (name: string, callback: Callback) => {
				callbacks.set(name, [...(callbacks.get(name) ?? []), callback]);
				return { callback, name };
			},
			process: async (file: TFile, fn: (content: string) => string) => {
				const read = contents.get(file.path) ?? "";
				const next = fn(read);
				if (next !== read) write(file, next);
				return next;
			},
			read: async (file: TFile) => contents.get(file.path) ?? "",
			rename,
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			getLeavesOfType: () => [],
			leftSplit: null,
			offref: () => {},
			on: () => ({}),
			setActiveLeaf: () => {},
		},
	} as unknown as App;

	return {
		app,
		content: (path: string) => contents.get(path),
		/** A file the user creates in Obsidian. */
		createByHand: (path: string, content = "") =>
			app.vault.create(path, content),
		/** A file or folder the user deletes in Obsidian. */
		deleteByHand: (path: string) => {
			const entry = byPath.get(path);
			if (!entry) throw new Error(`missing ${path}`);
			return app.fileManager.trashFile(entry);
		},
		/** An edit the user makes in Obsidian. */
		editByHand: (path: string, content: string) => {
			const entry = byPath.get(path);
			if (!(entry instanceof TFile)) throw new Error(`missing ${path}`);
			write(entry, content);
		},
		files: () =>
			[...byPath.values()]
				.filter((e) => e instanceof TFile)
				.map((e) => e.path)
				.sort(),
		/** A resolved link from `source` to `target`, as Obsidian indexes it. */
		linkTo: (source: string, target: string) => {
			resolvedLinks[source] = { ...resolvedLinks[source], [target]: 1 };
		},
		/** A rename the user makes in Obsidian. */
		renameByHand: (from: string, to: string) => {
			const entry = byPath.get(from);
			if (!entry) throw new Error(`missing ${from}`);
			return rename(entry, to);
		},
		trashed,
		/** Files the next renames rewrite though nothing predicts them. */
		unpredicted,
	};
}
