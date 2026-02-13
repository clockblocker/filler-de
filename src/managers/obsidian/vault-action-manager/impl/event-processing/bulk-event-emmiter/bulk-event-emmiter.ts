import type { App, TAbstractFile } from "obsidian";
import {
	decrementPending,
	incrementPending,
} from "../../../../../../utils/idle-tracker";
import { type VaultEvent, VaultEventKind } from "../../../types/vault-event";
import type { SelfEventTracker } from "../self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileDeleted,
	tryMakeVaultEventForFileRenamed,
} from "../vault-events-for-events";
import { BulkEventAccumulator } from "./batteries/event-accumulator";
import { collapseVaultEvents } from "./batteries/processing-chain/collapse";
import { reduceRoots } from "./batteries/processing-chain/reduce-roots";
import type { BulkVaultEvent } from "./types/bulk/bulk-vault-event";
import { isDelete, isRename } from "./types/bulk/helpers";

export type BulkVaultEventHandler = (bulk: BulkVaultEvent) => Promise<void>;

export class BulkEventEmmiter {
	private listeners: Array<() => void> = [];
	private readonly acc: BulkEventAccumulator;
	private handler: BulkVaultEventHandler | null = null;

	// Debug: store all received events (before filtering) for test diagnostics
	public _debugAllRawEvents: Array<{
		event: string;
		ignored: boolean;
		reason?: string;
	}> = [];

	constructor(
		private readonly app: App,
		private readonly selfEventTracker: SelfEventTracker,
		private readonly opts: {
			quietWindowMs?: number;
			maxWindowMs?: number;
		} = {},
	) {
		this.acc = new BulkEventAccumulator(
			(window) => {
				if (!this.handler) return;

				const rawEvents = window.allObsidianEvents;
				const trueCount = countEvents(rawEvents);

				const collapsedEvents = collapseVaultEvents(rawEvents);
				const collapsedCount = countEvents(collapsedEvents);

				const roots = reduceRoots(collapsedEvents);

				const bulk: BulkVaultEvent = {
					debug: {
						collapsedCount,
						endedAt: window.debug.endedAt,
						reduced: {
							rootDeletes: roots.filter(isDelete).length,
							rootRenames: roots.filter(isRename).length,
						},
						startedAt: window.debug.startedAt,
						trueCount,
					},
					events: collapsedEvents,
					roots,
				};

				incrementPending();
				this.handler(bulk).finally(() => decrementPending());
			},
			{
				maxWindowMs: this.opts.maxWindowMs ?? 2000,
				quietWindowMs: this.opts.quietWindowMs ?? 250,
			},
		);
	}

	start(handler: BulkVaultEventHandler): void {
		this.handler = handler;

		const onCreate = this.app.vault.on("create", (file) =>
			this.onCreate(file),
		);
		const onRename = this.app.vault.on("rename", (file, oldPath) =>
			this.onRename(file, oldPath),
		);
		const onDelete = this.app.vault.on("delete", (file) =>
			this.onDelete(file),
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

		this.acc.clear();
		this.handler = null;
	}

	resetDebugState(): void {
		this._debugAllRawEvents = [];
	}

	private push(event: VaultEvent): void {
		if (!this.handler) return; // drop events if stopped
		this.acc.push(event);
	}

	private onCreate(tAbstractFile: TAbstractFile): void {
		const path = tAbstractFile.path;
		const ignored = this.selfEventTracker.shouldIgnore(path);

		this._debugAllRawEvents.push({
			event: `onCreate: ${path}`,
			ignored,
			reason: ignored ? "selfEventTracker" : undefined,
		});

		if (ignored) return;
		this.push(makeVaultEventForFileCreated(tAbstractFile));
	}

	private onRename(tAbstractFile: TAbstractFile, oldPath: string): void {
		const newPathIgnored = this.selfEventTracker.shouldIgnore(
			tAbstractFile.path,
		);
		const oldPathIgnored = this.selfEventTracker.shouldIgnore(oldPath);

		if (newPathIgnored && oldPathIgnored) {
			this._debugAllRawEvents.push({
				event: `onRename: ${oldPath} → ${tAbstractFile.path}`,
				ignored: true,
				reason: `newPath: ${newPathIgnored}, oldPath: ${oldPathIgnored}`,
			});
			return;
		}

		const res = tryMakeVaultEventForFileRenamed(tAbstractFile, oldPath);
		if (res.isErr()) {
			this._debugAllRawEvents.push({
				event: `onRename: ${oldPath} → ${tAbstractFile.path}`,
				ignored: true,
				reason: `makeEvent failed: ${res.error}`,
			});
			return;
		}
		this._debugAllRawEvents.push({
			event: `onRename: ${oldPath} → ${tAbstractFile.path} (kind=${res.value.kind})`,
			ignored: false,
		});
		this.push(res.value);
	}

	private onDelete(tAbstractFile: TAbstractFile): void {
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) return;
		this.push(makeVaultEventForFileDeleted(tAbstractFile));
	}
}

function countEvents(events: VaultEvent[]) {
	let renames = 0;
	let creates = 0;
	let deletes = 0;

	for (const e of events) {
		switch (e.kind) {
			case VaultEventKind.FileRenamed:
			case VaultEventKind.FolderRenamed:
				renames++;
				break;

			case VaultEventKind.FileCreated:
			case VaultEventKind.FolderCreated:
				creates++;
				break;

			case VaultEventKind.FileDeleted:
			case VaultEventKind.FolderDeleted:
				deletes++;
				break;
		}
	}

	return { creates, deletes, renames };
}
