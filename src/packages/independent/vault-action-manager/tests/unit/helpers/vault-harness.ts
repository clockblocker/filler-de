import {
	type App,
	MarkdownView,
	type TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";

/**
 * A vault whose writes fire Obsidian's modify callback, and whose
 * `FileManager.renameFile` rewrites the files listed in `linkingFiles`, as
 * Obsidian's link updater does. Writes to a path in `failingWrites` throw,
 * and `beforeProcess` runs before each `Vault.process` reads its file. Its
 * adapter reports a case-insensitive file system, as Obsidian's does on
 * macOS, unless `insensitive` is false.
 */
export function makeVaultHarness({ insensitive = true } = {}) {
	const callbacks = new Map<string, (...args: never[]) => void>();
	const contents = new Map<string, string>();
	const byPath = new Map<string, TAbstractFile>();
	const writes: string[] = [];
	const openPaths = new Set<string>();
	const linkingFiles: TFile[] = [];
	const failingWrites = new Set<string>();
	const hooks: { beforeProcess?: (file: TFile) => void } = {};

	const ensureFolder = (path: string): TFolder => {
		const existing = byPath.get(path);
		if (existing instanceof TFolder) return existing;
		const created = new TFolder();
		created.path = path;
		created.name = path.split("/").at(-1) ?? path;
		created.children = [];
		byPath.set(path, created);
		return created;
	};

	const addFile = (path: string, content: string) => {
		const file = new TFile();
		file.path = path;
		const name = path.split("/").at(-1) ?? path;
		file.extension = name.split(".").at(-1) ?? "";
		file.basename = name.slice(0, -(file.extension.length + 1));
		file.name = name;
		const parent = ensureFolder(path.split("/").slice(0, -1).join("/"));
		file.parent = parent;
		parent.children.push(file);
		file.stat = { ctime: 1, mtime: Date.now(), size: content.length };
		byPath.set(path, file);
		contents.set(path, content);
		return file;
	};

	const write = (file: TFile, content: string) => {
		if (failingWrites.has(file.path))
			throw new Error(`cannot write ${file.path}`);
		writes.push(file.path);
		contents.set(file.path, content);
		file.stat = { ...file.stat, mtime: Date.now(), size: content.length };
		callbacks.get("modify")?.(file as never);
	};

	const move = (file: TAbstractFile, toPath: string) => {
		writes.push(`${file.path} -> ${toPath}`);
		byPath.delete(file.path);
		const content = contents.get(file.path);
		contents.delete(file.path);
		const oldPath = file.path;
		file.path = toPath;
		byPath.set(toPath, file);
		if (content !== undefined) contents.set(toPath, content);
		callbacks.get("rename")?.(file as never, oldPath as never);
	};

	const leaves = () =>
		[...openPaths].map((path) => {
			const view = new MarkdownView({} as never);
			view.file = byPath.get(path) as TFile;
			return { view };
		});

	const app = {
		fileManager: {
			renameFile: async (file: TAbstractFile, toPath: string) => {
				move(file, toPath);
				for (const linking of linkingFiles) {
					write(
						linking,
						`${contents.get(linking.path)} [[${toPath}]]`,
					);
				}
			},
			trashFile: async (file: TAbstractFile) => {
				writes.push(`trash ${file.path}`);
				byPath.delete(file.path);
			},
		},
		metadataCache: { getFirstLinkpathDest: () => null },
		vault: {
			adapter: { insensitive },
			create: async (path: string, content: string) => {
				writes.push(`create ${path}`);
				return addFile(path, content);
			},
			createFolder: async (path: string) => ensureFolder(path),
			getAbstractFileByPath: (path: string) => byPath.get(path) ?? null,
			getMarkdownFiles: () =>
				[...byPath.values()].filter(
					(file): file is TFile => file instanceof TFile,
				),
			getRoot: () => ensureFolder(""),
			modify: async (file: TFile, content: string) =>
				write(file, content),
			offref: () => {},
			on: (name: string, callback: (...args: never[]) => void) => {
				callbacks.set(name, callback);
				return { callback, name };
			},
			process: async (file: TFile, fn: (content: string) => string) => {
				hooks.beforeProcess?.(file);
				const read = contents.get(file.path) ?? "";
				const next = fn(read);
				if (next !== read) write(file, next);
				return next;
			},
			read: async (file: TFile) => contents.get(file.path) ?? "",
			rename: async (file: TAbstractFile, toPath: string) =>
				move(file, toPath),
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			getLeavesOfType: (type: string) =>
				type === "markdown" ? leaves() : [],
			leftSplit: null,
			setActiveLeaf: () => {},
		},
	} as unknown as App;

	return {
		addFile,
		app,
		contents,
		/** An edit Obsidian reports but VAM did not make. */
		editByHand: (file: TFile, content: string) => write(file, content),
		exists: (path: string) => byPath.has(path),
		failingWrites,
		hooks,
		linkingFiles,
		open: (path: string) => openPaths.add(path),
		writes,
	};
}
