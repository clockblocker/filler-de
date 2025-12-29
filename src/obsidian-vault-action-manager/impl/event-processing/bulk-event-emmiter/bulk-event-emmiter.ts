import type { App, TAbstractFile } from "obsidian";
import { type VaultEvent, VaultEventType } from "../../../types/vault-event";
import type { SelfEventTracker } from "../self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileDeleted,
	tryMakeVaultEventForFileRenamed,
} from "../vault-events-for-events";
import { BulkEventAccumulator } from "./batteries/event-accumulator";
import type { BulkVaultEvent } from "./types/bulk/bulk-vault-event";
import {
	isPossibleRoot,
	isRename,
	isTrash,
	type PossibleRootVaultEvent,
} from "./types/bulk/helpers";

export type BulkVaultEventHandler = (bulk: BulkVaultEvent) => Promise<void>;

export class BulkEventEmmiter {
	private listeners: Array<() => void> = [];
	private readonly acc: BulkEventAccumulator;
	private handler: BulkVaultEventHandler | null = null;

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

				const events = window.allObsidianEvents;

				const trueCount = countEvents(events);

				// v0: no collapse, no roots reduction
				const collapsedCount = { ...trueCount };
				const roots = events.filter(
					isPossibleRoot,
				) as Array<PossibleRootVaultEvent>;

				const bulk: BulkVaultEvent = {
					debug: {
						collapsedCount,
						endedAt: window.debug.endedAt,
						reduced: {
							rootDeletes: roots.filter(isTrash).length,
							rootRenames: roots.filter(isRename).length,
						},
						startedAt: window.debug.startedAt,
						trueCount,
					},
					events,
					roots,
				};

				void this.handler(bulk);
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

	private push(event: VaultEvent): void {
		if (!this.handler) return; // drop events if stopped
		this.acc.push(event);
	}

	private onCreate(tAbstractFile: TAbstractFile): void {
		if (this.selfEventTracker.shouldIgnore(tAbstractFile.path)) return;
		this.push(makeVaultEventForFileCreated(tAbstractFile));
	}

	private onRename(tAbstractFile: TAbstractFile, oldPath: string): void {
		if (
			this.selfEventTracker.shouldIgnore(tAbstractFile.path) ||
			this.selfEventTracker.shouldIgnore(oldPath)
		) {
			return;
		}

		const res = tryMakeVaultEventForFileRenamed(tAbstractFile, oldPath);
		if (res.isErr()) return;
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
		switch (e.type) {
			case VaultEventType.FileRenamed:
			case VaultEventType.FolderRenamed:
				renames++;
				break;

			case VaultEventType.FileCreated:
			case VaultEventType.FolderCreated:
				creates++;
				break;

			case VaultEventType.FileDeleted:
			case VaultEventType.FolderDeleted:
				deletes++;
				break;
		}
	}

	return { creates, deletes, renames };
}
