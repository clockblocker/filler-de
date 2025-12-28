import type { App, TAbstractFile } from "obsidian";
import type { VaultEventHandler } from "../index";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type { SelfEventTrackerLegacy } from "./self-event-tracker";
import { makeSplitPath } from "./split-path-and-system-path";

export class EventAdapter {
	private listeners: Array<() => void> = [];

	constructor(
		private readonly app: App,
		private readonly selfEventTracker: SelfEventTrackerLegacy,
	) {}

	start(handler: VaultEventHandler): void {
		const onCreate = this.app.vault.on("create", (file) =>
			this.emitFileCreated(file, handler),
		);
		const onRename = this.app.vault.on("rename", (file, oldPath) =>
			this.emitFileRenamed(file, oldPath, handler),
		);
		const onDelete = this.app.vault.on("delete", (file) =>
			this.emitFileTrashed(file, handler),
		);
		this.listeners.push(
			() => this.app.vault.offref(onCreate),
			() => this.app.vault.offref(onRename),
			() => this.app.vault.offref(onDelete),
		);
	}

	stop(): void {
		for (const off of this.listeners) off();
		this.listeners = [];
	}

	private emitFileCreated(
		tAbstractFile: TAbstractFile,
		handler: VaultEventHandler,
	): void {
		// Filter self-events (actions we dispatched)
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
			return;
		}

		const split = makeSplitPath(tAbstractFile);
		if (split.type === "Folder") {
			void handler({
				splitPath: split as SplitPathToFolder,
				type: "FolderCreated",
			});
		} else {
			void handler({
				splitPath: split as SplitPathToFile | SplitPathToMdFile,
				type: "FileCreated",
			});
		}
	}

	private emitFileRenamed(
		tAbstractFile: TAbstractFile,
		oldPath: string,
		handler: VaultEventHandler,
	): void {
		// Filter self-events (actions we dispatched)
		// Check new path (file.path) - old path already handled by tracking 'from' in self-event tracker
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
			return;
		}

		const split = makeSplitPath(tAbstractFile);
		const from = makeSplitPath(oldPath);

		if (split.type === "Folder" && from.type === "Folder") {
			void handler({
				from: from as SplitPathToFolder,
				to: split as SplitPathToFolder,
				type: "FolderRenamed",
			});
		} else if (split.type !== "Folder" && from.type !== "Folder") {
			void handler({
				from: from as SplitPathToFile | SplitPathToMdFile,
				to: split as SplitPathToFile | SplitPathToMdFile,
				type: "FileRenamed",
			});
		}
		// Mixed folder/file renames are invalid, skip
	}

	private emitFileTrashed(
		tAbstractFile: TAbstractFile,
		handler: VaultEventHandler,
	): void {
		// Filter self-events (actions we dispatched)
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
			return;
		}

		const split = makeSplitPath(tAbstractFile);
		if (split.type === "Folder") {
			void handler({
				splitPath: split,
				type: "FolderTrashed",
			});
		} else {
			void handler({
				splitPath: split,
				type: "FileTrashed",
			});
		}
	}
}
