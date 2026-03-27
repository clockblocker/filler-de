import type { App, TAbstractFile } from "obsidian";
import type { VaultEventHandler } from "../../index";
import type { SelfEventTracker } from "./self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileDeleted,
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
			this.emitFileDeleted(file, handler),
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
		// Evaluate both BEFORE the if — both paths must be checked to
		// pop them from the tracker (pop-on-match). Only ignore when
		// BOTH match, confirming this is a genuine self-event rename.
		const newPathIgnored = this.selfEventTracker.shouldIgnore(
			tAbstractFile.path,
		);
		const oldPathIgnored = this.selfEventTracker.shouldIgnore(oldPath);
		if (newPathIgnored && oldPathIgnored) {
			return;
		}

		const res = tryMakeVaultEventForFileRenamed(tAbstractFile, oldPath);
		if (res.isErr()) {
			return;
		}
		void handler(res.value);
	}

	private emitFileDeleted(
		tAbstractFile: TAbstractFile,
		handler: VaultEventHandler,
	): void {
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) {
			return;
		}

		void handler(makeVaultEventForFileDeleted(tAbstractFile));
	}
}
