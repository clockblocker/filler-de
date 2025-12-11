import type { App, TAbstractFile } from "obsidian";
import type { VaultEvent, VaultEventHandler } from "../index";
import { CREATE, FILE, RENAME, TRASH } from "../types/literals";
import type { SelfEventTracker } from "./self-event-tracker";
import { splitPath, splitPathKey } from "./split-path";

export class EventAdapter {
	private listeners: Array<() => void> = [];

	constructor(
		private readonly app: App,
		private readonly selfEvents: SelfEventTracker,
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
		file: TAbstractFile,
		handler: VaultEventHandler,
	): void {
		const split = splitPath(file);
		if (split.type === "Folder") return;
		if (this.selfEvents.consume(splitPathKey(split))) return;
		void handler({
			splitPath: split,
			type: `${FILE}${CREATE}d` as const,
		});
	}

	private emitFileRenamed(
		file: TAbstractFile,
		oldPath: string,
		handler: VaultEventHandler,
	): void {
		const split = splitPath(file);
		if (split.type === "Folder") return;
		const from = splitPath(oldPath);
		if (from.type === "Folder") return;
		if (
			this.selfEvents.consume(splitPathKey(split)) ||
			this.selfEvents.consume(splitPathKey(from))
		)
			return;
		void handler({
			from,
			to: split,
			type: `${FILE}${RENAME}d` as const,
		});
	}

	private emitFileTrashed(
		file: TAbstractFile,
		handler: VaultEventHandler,
	): void {
		const split = splitPath(file);
		if (split.type === "Folder") return;
		if (this.selfEvents.consume(splitPathKey(split))) return;
		void handler({
			splitPath: split,
			type: `${FILE}${TRASH}ed` as const,
		});
	}
}
