/**
 * The reset's backup move over a real VAM (#65): with Obsidian's
 * "Automatically update internal links" on, `FileManager.renameFile`
 * rewrites links in the moved notes, so a backup made through it no longer
 * holds the notes as Collect read them. The fake app below rewrites links
 * on `fileManager.renameFile`, as Obsidian does, and only moves on
 * `vault.rename`.
 */
import { describe, expect, it } from "bun:test";
import { createVaultActionManager } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import { vamResetVault } from "../../../src/commanders/dictionary-reset/vam-reset-vault";

const FAHRKARTE = "Worter/de/lexem/lemma/f/fah/fahrk/Fahrkarte.md";
const FAHRKARTE_CONTENT = "[[Fahren|fahr]]|[[k]]|[[Karte|arte]]\n\n[[Fahren]] + [[Karte]]\n";
const OUTSIDE = "Wortlisten/Zeit.md";
const OUTSIDE_CONTENT = "- der [[fahrkarte]]\n";

function makeVault() {
	const contents = new Map<string, string>();
	const byPath = new Map<string, TAbstractFile>();
	const calls: string[] = [];

	const root = new TFolder();
	root.path = "/";
	root.name = "";
	root.children = [];
	root.isRoot = () => true;

	const folderAt = (path: string): TFolder => {
		const known = byPath.get(path);
		if (known instanceof TFolder) return known;
		const slash = path.lastIndexOf("/");
		const parent = slash < 0 ? root : folderAt(path.slice(0, slash));
		const folder = new TFolder();
		folder.path = path;
		folder.name = path.slice(slash + 1);
		folder.children = [];
		folder.parent = parent;
		parent.children.push(folder);
		byPath.set(path, folder);
		return folder;
	};

	const addFile = (path: string, content: string) => {
		const slash = path.lastIndexOf("/");
		const parent = folderAt(path.slice(0, slash));
		const file = new TFile();
		file.path = path;
		file.name = path.slice(slash + 1);
		file.extension = "md";
		file.basename = file.name.slice(0, -3);
		file.parent = parent;
		file.stat = { ctime: 1, mtime: 1, size: content.length };
		parent.children.push(file);
		byPath.set(path, file);
		contents.set(path, content);
	};

	const files = () =>
		[...byPath.values()].filter((file): file is TFile => file instanceof TFile);

	/** Moves `entry` and everything below it, changing no content. */
	const move = (entry: TAbstractFile, toPath: string) => {
		const from = entry.path;
		for (const [path, value] of [...byPath]) {
			if (path !== from && !path.startsWith(`${from}/`)) continue;
			const next = `${toPath}${path.slice(from.length)}`;
			byPath.delete(path);
			value.path = next;
			byPath.set(next, value);
			const content = contents.get(path);
			if (content !== undefined) {
				contents.delete(path);
				contents.set(next, content);
			}
		}
		entry.name = toPath.split("/").at(-1) ?? toPath;
	};

	/**
	 * What "Automatically update internal links" does after a move: a link
	 * whose text differs from the target's name only in case is rewritten to
	 * the name, in every note, the moved ones included.
	 */
	const updateLinks = () => {
		const names = files().map((file) => file.basename);
		for (const file of files()) {
			const content = contents.get(file.path) ?? "";
			const next = content.replace(
				/\[\[([^\]|#]+)/g,
				(link, target: string) => {
					const name = names.find(
						(candidate) =>
							candidate !== target &&
							candidate.toLowerCase() === target.toLowerCase(),
					);
					return name ? `[[${name}` : link;
				},
			);
			contents.set(file.path, next);
		}
	};

	const app = {
		fileManager: {
			renameFile: async (entry: TAbstractFile, toPath: string) => {
				calls.push("fileManager.renameFile");
				move(entry, toPath);
				updateLinks();
			},
			trashFile: async () => {
				throw new Error("the reset never trashes");
			},
		},
		metadataCache: { getFirstLinkpathDest: () => null },
		vault: {
			cachedRead: async (file: TFile) => contents.get(file.path) ?? "",
			create: async (path: string, content: string) => {
				calls.push(`vault.create ${path}`);
				addFile(path, content);
				return byPath.get(path);
			},
			createFolder: async () => {
				throw new Error("not used");
			},
			// As in Obsidian: the root is found as "/" (or `getRoot()`), not "".
			getAbstractFileByPath: (path: string) =>
				path === "/" ? root : (byPath.get(path) ?? null),
			getMarkdownFiles: files,
			getRoot: () => root,
			modify: async () => {
				throw new Error("not used");
			},
			offref: () => {},
			on: (name: string, callback: unknown) => ({ callback, name }),
			read: async (file: TFile) => contents.get(file.path) ?? "",
			rename: async (entry: TAbstractFile, toPath: string) => {
				calls.push("vault.rename");
				move(entry, toPath);
			},
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			getLeavesOfType: () => [],
			leftSplit: null,
			setActiveLeaf: () => {},
		},
	} as unknown as App;

	addFile(FAHRKARTE, FAHRKARTE_CONTENT);
	addFile("Worter/de/lexem/lemma/f/fah/fahre/fahren.md", "# fahren\n");
	addFile("Worter/de/lexem/lemma/k/kar/karte/Karte.md", "# Karte\n");
	addFile(OUTSIDE, OUTSIDE_CONTENT);
	return { addFile, app, calls, contents };
}

describe("the reset's backup move", () => {
	it("keeps every moved note, and every note outside, as it was", async () => {
		const { app, calls, contents } = makeVault();
		const { dispose, manager } = createVaultActionManager(app);
		const vault = vamResetVault(manager);
		const backup = "Worter backup 2026-10-20 20-44-26";

		const { listed, roots } = await Effect.runPromise(
			Effect.gen(function* () {
				yield* vault.moveFolder("Worter", backup);
				return {
					listed: yield* vault.listFolder(backup),
					// What finds a backup folder as the next reset's source (#117).
					roots: yield* vault.listRootFolders,
				};
			}),
		);
		await Effect.runPromise(dispose);
		expect([...roots].sort()).toEqual([backup, "Wortlisten"]);

		expect(
			listed?.markdown.find(
				({ path }) => path === `${backup}/de/lexem/lemma/f/fah/fahrk/Fahrkarte.md`,
			)?.content,
		).toBe(FAHRKARTE_CONTENT);
		expect(contents.get(OUTSIDE)).toBe(OUTSIDE_CONTENT);
		expect(calls).toEqual(["vault.rename"]);
		expect([...contents.keys()].some((path) => path.startsWith("Worter/"))).toBe(
			false,
		);
	});
});

describe("the reset's root listing", () => {
	it("lists the vault's top-level folders, the root found only as \"/\"", async () => {
		const { app } = makeVault();
		const { dispose, manager } = createVaultActionManager(app);
		const roots = await Effect.runPromise(
			vamResetVault(manager).listRootFolders,
		);
		await Effect.runPromise(dispose);
		expect([...roots].sort()).toEqual(["Worter", "Wortlisten"]);
	});

	it("says why it could not list the root", async () => {
		const { app } = makeVault();
		app.vault.getRoot = () => {
			throw new Error("vault not loaded");
		};
		const { dispose, manager } = createVaultActionManager(app);
		const failure = await Effect.runPromise(
			Effect.flip(vamResetVault(manager).listRootFolders),
		);
		await Effect.runPromise(dispose);
		expect(failure.message).toBe(
			"Could not list the vault's folders: listFolder (vault root): Folder not found: vault not loaded",
		);
	});
});

describe("the reset's create-only writes and fail-on-collision move", () => {
	it("refuses to move Worter/ onto a backup folder that is already there, moving nothing", async () => {
		const { addFile, app, calls, contents } = makeVault();
		const backup = "Worter backup 2026-10-20 20-44-26";
		addFile(`${backup}/kept.md`, "already here");
		const { dispose, manager } = createVaultActionManager(app);
		const failure = await Effect.runPromise(
			Effect.flip(vamResetVault(manager).moveFolder("Worter", backup)),
		);
		await Effect.runPromise(dispose);
		expect(failure.message).toContain(`Could not move Worter/ to ${backup}/`);
		expect(failure.message).toContain("already exists");
		expect(calls).toEqual([]);
		expect(contents.get(FAHRKARTE)).toBe(FAHRKARTE_CONTENT);
		expect(contents.get(`${backup}/kept.md`)).toBe("already here");
		expect([...contents.keys()].some((path) => path.startsWith("1_"))).toBe(
			false,
		);
	});

	it("creates a note where none is", async () => {
		const { app, calls, contents } = makeVault();
		const { dispose, manager } = createVaultActionManager(app);
		await Effect.runPromise(
			vamResetVault(manager).createNote("Wortlisten/Reset.md", "report"),
		);
		await Effect.runPromise(dispose);
		expect(calls).toEqual(["vault.create Wortlisten/Reset.md"]);
		expect(contents.get("Wortlisten/Reset.md")).toBe("report");
	});

	it("refuses to create a note over one that is there, or over its case variant on macOS", async () => {
		const { app, calls, contents } = makeVault();
		const { dispose, manager } = createVaultActionManager(app, {
			fileSystem: { caseInsensitive: true },
		});
		const vault = vamResetVault(manager);
		const exact = await Effect.runPromise(
			Effect.flip(vault.createNote(OUTSIDE, "report")),
		);
		const variant = await Effect.runPromise(
			Effect.flip(vault.createNote("Wortlisten/zeit.md", "report")),
		);
		await Effect.runPromise(dispose);
		expect(exact.message).toContain(`Could not write ${OUTSIDE}`);
		expect(exact.message).toContain("already exists");
		expect(variant.message).toContain(
			`${OUTSIDE} already exists, which is Wortlisten/zeit.md`,
		);
		expect(calls).toEqual([]);
		expect(contents.get(OUTSIDE)).toBe(OUTSIDE_CONTENT);
	});
});
