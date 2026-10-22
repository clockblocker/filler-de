/**
 * The Librarian over the real Vault Action Manager, healing a folder rename
 * the user makes into a section move. The heal itself renames a folder, and
 * Obsidian reports that rename for every descendant; none of those reports
 * may reach the Librarian as a second user change.
 */
import { afterEach, beforeEach, describe, expect, it, type spyOn } from "bun:test";
import {
	type BulkVaultEvent,
	createVaultActionManager,
	splitPathCodec,
	type VaultAction,
	type VaultEvent,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import {
	Librarian,
	type LibrarianStop,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";

let settingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	settingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	settingsSpy.mockRestore();
});

type Callback = (...args: never[]) => void;

/**
 * An in-memory Obsidian vault holding `initial` (path to content). Renaming a
 * folder reports a rename for the folder and then for every descendant, and
 * trashing a folder reports a delete for it and every descendant, as
 * Obsidian does.
 */
function makeObsidianVault(initial: Record<string, string>) {
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

	const app = {
		fileManager: {
			renameFile: rename,
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
		metadataCache: { getFirstLinkpathDest: () => null },
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
			getMarkdownFiles: () =>
				[...byPath.values()].filter(
					(f): f is TFile => f instanceof TFile && f.extension === "md",
				),
			getRoot: () => root,
			modify: async (file: TFile, content: string) => write(file, content),
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
		files: () =>
			[...byPath.values()]
				.filter((e) => e instanceof TFile)
				.map((e) => e.path)
				.sort(),
		/** A rename the user makes in Obsidian. */
		renameByHand: (from: string, to: string) => {
			const entry = byPath.get(from);
			if (!entry) throw new Error(`missing ${from}`);
			return rename(entry, to);
		},
		trashed,
	};
}

function describeRoot(event: VaultEvent): string {
	return "from" in event
		? `${event.kind} ${splitPathCodec.format(event.from)} -> ${splitPathCodec.format(event.to)}`
		: `${event.kind} ${splitPathCodec.format(event.splitPath)}`;
}

/** The Librarian over real VAM, recording what crosses between them. */
async function startLibrarian(vault: ReturnType<typeof makeObsidianVault>) {
	const { dispose, manager, testing } = createVaultActionManager(vault.app);
	const bulks: BulkVaultEvent[] = [];
	const batches: VaultAction[][] = [];
	const stops: LibrarianStop[] = [];
	const vam: LibrarianVam = {
		cd: (...args) => manager.cd(...args),
		dispatch: (actions) => {
			batches.push([...actions]);
			return manager.dispatch(actions);
		},
		getActiveEditorContext: (...args) =>
			manager.getActiveEditorContext(...args),
		getOpenedContent: (...args) => manager.getOpenedContent(...args),
		mdPwd: (...args) => manager.mdPwd(...args),
		scan: (...args) => manager.scan(...args),
		subscribeToBulk: (handler) =>
			manager.subscribeToBulk((bulk) => {
				bulks.push(bulk);
				return handler(bulk);
			}),
	};
	const librarian = new Librarian(vam, {
		onStopped: (stop) => void stops.push(stop),
	});
	await Effect.runPromise(manager.startListening());
	await Effect.runPromise(librarian.init());
	const settle = () => Effect.runPromise(testing.whenSettled());
	await settle();
	return {
		batches,
		bulks,
		/** Forgets what startup sent and received. */
		reset: () => {
			bulks.length = 0;
			batches.length = 0;
			vault.trashed.length = 0;
		},
		settle,
		stop: async () => {
			await Effect.runPromise(librarian.unsubscribe());
			await Effect.runPromise(dispose);
		},
		stops,
	};
}

describe("Librarian section-move heal over real VAM", () => {
	it(
		"heals a folder renamed into a section move in one batch, and hears nothing back from it",
		async () => {
			const vault = makeObsidianVault({
				"Library/Recipe/Pie/Ingredients.md": "# Ingredients",
				"Library/Recipe/Pie/Result_picture.jpg": "x",
				"Library/Recipe/Pie/Steps.md": "# Steps",
				"Library/Recipe/Pie/Sub/Deep.md": "# Deep",
				"Library/Recipe/Pie/Sub/Inner/Deeper.md": "# Deeper",
			});
			const librarian = await startLibrarian(vault);
			try {
				expect(vault.files()).toContain(
					"Library/Recipe/Pie/Sub/Inner/__-Inner-Sub-Pie-Recipe.md",
				);
				librarian.reset();

				// `Fish-Pie` names the section `Fish` inside `Pie`.
				await vault.renameByHand(
					"Library/Recipe/Pie",
					"Library/Recipe/Fish-Pie",
				);
				await librarian.settle();

				// Only the user's rename reaches the Librarian. Its heal
				// renames `Fish-Pie` to `Pie/Fish`, and Obsidian's reports
				// for that folder's descendants are Self Events.
				expect(
					librarian.bulks.map((bulk) => bulk.roots.map(describeRoot)),
				).toEqual([
					["FolderRenamed Library/Recipe/Pie -> Library/Recipe/Fish-Pie"],
				]);
				expect(librarian.batches).toHaveLength(1);
				expect(librarian.stops).toEqual([]);

				// The heal trashes every stale Codex, nested ones included,
				// before it moves their folder away.
				expect(vault.trashed.sort()).toEqual([
					"Library/Recipe/Fish-Pie/Sub/Inner/__-Inner-Sub-Pie-Recipe.md",
					"Library/Recipe/Fish-Pie/Sub/__-Sub-Pie-Recipe.md",
					"Library/Recipe/Fish-Pie/__-Pie-Recipe.md",
				]);
				expect(vault.files()).toEqual([
					"Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Result_picture-Fish-Pie-Recipe.jpg",
					"Library/Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/Deep-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/Inner/Deeper-Inner-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/Inner/__-Inner-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/__-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/__-Pie-Recipe.md",
					"Library/Recipe/__-Recipe.md",
					"Library/__-Library.md",
				]);
			} finally {
				await librarian.stop();
			}
		},
		// Settling waits out the Self Event TTL of paths Obsidian never reports.
		30_000,
	);
});
