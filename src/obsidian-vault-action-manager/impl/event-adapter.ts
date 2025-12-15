import type { App, TAbstractFile } from "obsidian";
import type { VaultEventHandlerLegacy } from "../index";
import { CREATE, FILE, RENAME, TRASH } from "../types/literals";
import type { SplitPathToFile, SplitPathToMdFile } from "../types/split-path";
import type { SelfEventTrackerLegacy } from "./self-event-tracker";
import { splitPath } from "./split-path";

export class EventAdapter {
	private listeners: Array<() => void> = [];

	constructor(
		private readonly app: App,
		private readonly selfEventTracker: SelfEventTrackerLegacy,
	) {}

	start(handler: VaultEventHandlerLegacy): void {
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
		file: TAbstractFile,
		handler: VaultEventHandlerLegacy,
	): void {
		// Filter self-events (actions we dispatched)
		if (this.selfEventTracker.shouldIgnore(file.path)) {
			return;
		}

		const split = splitPath(file);
		if (split.type === "Folder") return;
		void handler({
			splitPath: split as SplitPathToFile | SplitPathToMdFile,
			type: `${FILE}${CREATE}d` as const,
		});
	}

	private emitFileRenamed(
		file: TAbstractFile,
		oldPath: string,
		handler: VaultEventHandlerLegacy,
	): void {
		// Filter self-events (actions we dispatched)
		// Check new path (file.path) - old path already handled by tracking 'from' in self-event tracker
		if (this.selfEventTracker.shouldIgnore(file.path)) {
			return;
		}

		const split = splitPath(file);
		if (split.type === "Folder") return;
		const from = splitPath(oldPath);
		if (from.type === "Folder") return;

		void handler({
			from: from as SplitPathToFile | SplitPathToMdFile,
			to: split as SplitPathToFile | SplitPathToMdFile,
			type: `${FILE}${RENAME}d` as const,
		});
	}

	private emitFileTrashed(
		file: TAbstractFile,
		handler: VaultEventHandlerLegacy,
	): void {
		// Filter self-events (actions we dispatched)
		if (this.selfEventTracker.shouldIgnore(file.path)) {
			return;
		}

		const split = splitPath(file);
		if (split.type === "Folder") return;
		void handler({
			splitPath: split as SplitPathToFile | SplitPathToMdFile,
			type: `${FILE}${TRASH}ed` as const,
		});
	}
}
