import type { App, TAbstractFile } from "obsidian";
import type { VaultEventHandler } from "../../index";
import type { SelfEventTracker } from "./self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileTrashed,
	tryMakeVaultEventForFileRenamed,
} from "./vault-events-for-events";

export class SingleEventEmmiter {
	private listeners: Array<() => void> = [];

	constructor(
		private readonly app: App,
		private readonly selfEventTracker: SelfEventTracker,
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
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
			return;
		}

		void handler(makeVaultEventForFileCreated(tAbstractFile));
	}

	private emitFileRenamed(
		tAbstractFile: TAbstractFile,
		oldPath: string,
		handler: VaultEventHandler,
	): void {
		const res = tryMakeVaultEventForFileRenamed(tAbstractFile, oldPath);

		if (
			this.selfEventTracker.shouldIgnore(tAbstractFile.path) ||
			this.selfEventTracker.shouldIgnore(oldPath) ||
			res.isErr()
		) {
			return;
		}
		void handler(res.value);
	}

	private emitFileTrashed(
		tAbstractFile: TAbstractFile,
		handler: VaultEventHandler,
	): void {
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
			return;
		}

		void handler(makeVaultEventForFileTrashed(tAbstractFile));
	}
}
