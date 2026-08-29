import { type App, TFile, TFolder } from "obsidian";
import type { SplitPathToFolder, SplitPathToMdFile } from "../../../src";

export const mdPath: SplitPathToMdFile = {
	basename: "note",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Library"],
};

export const folderPath: SplitPathToFolder = {
	basename: "Library",
	kind: "Folder",
	pathParts: [],
};

export function makeFacadeHarness() {
	const callbacks = new Map<string, (...args: never[]) => void>();
	const removed: unknown[] = [];
	let scrollCount = 0;

	const file = new TFile();
	file.path = "Library/note.md";
	file.basename = "note";
	file.extension = "md";
	const folder = new TFolder();
	folder.path = "Library";
	folder.name = "Library";
	folder.children = [file];
	file.parent = folder;

	const editor = {
		getCursor: () => ({ ch: 0, line: 0 }),
		getSelection: () => "content",
		getValue: () => "content",
		listSelections: () => [
			{
				anchor: { ch: 0, line: 0 },
				head: { ch: 7, line: 0 },
			},
		],
		posToOffset: () => 0,
		scrollIntoView: () => {
			scrollCount++;
		},
	};
	const view = {
		contentEl: { querySelector: () => ({}) },
		editor,
		file,
		getMode: () => "source",
	};
	const leaf = { openFile: async () => {} };
	const vault = {
		create: async () => file,
		createFolder: async () => folder,
		getAbstractFileByPath: (path: string) => {
			if (path === file.path) return file;
			if (path === folder.path) return folder;
			return null;
		},
		getMarkdownFiles: () => [file],
		modify: async () => {},
		offref: (ref: unknown) => removed.push(ref),
		on: (name: string, callback: (...args: never[]) => void) => {
			callbacks.set(name, callback);
			return { callback, name };
		},
		read: async () => "content",
	};
	const app = {
		fileManager: {
			renameFile: async () => {},
			trashFile: async () => {},
		},
		metadataCache: {
			getFirstLinkpathDest: () => file,
		},
		vault,
		workspace: {
			getActiveViewOfType: () => view,
			getLeaf: () => leaf,
			getLeavesOfType: () => [],
			leftSplit: null,
			setActiveLeaf: () => {},
		},
	} as unknown as App;

	return {
		app,
		callbacks,
		getScrollCount: () => scrollCount,
		removed,
	};
}
