import type { App, TAbstractFile } from "obsidian";
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

// Debug logging
function debugLog(msg: string): void {
	console.log(`[BULK-EVENT-DEBUG] ${msg}`);
}

export type BulkVaultEventHandler = (bulk: BulkVaultEvent) => Promise<void>;

export class BulkEventEmmiter {
	private listeners: Array<() => void> = [];
	private readonly acc: BulkEventAccumulator;
	private handler: BulkVaultEventHandler | null = null;

	// Debug: store all received events (before filtering)
	public _debugAllRawEvents: Array<{ event: string; ignored: boolean; reason?: string }> = [];

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
				debugLog(`accumulator flush: ${window.allObsidianEvents.length} raw events`);

				if (!this.handler) {
					debugLog(`accumulator flush: NO HANDLER!`);
					return;
				}

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

				debugLog(`accumulator flush: calling handler with ${bulk.events.length} events, ${bulk.roots.length} roots`);
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
		debugLog(`onRename: ${oldPath} → ${tAbstractFile.path}`);

		// For folder renames, log the current tracker state BEFORE checking
		const isFolder = !tAbstractFile.extension || tAbstractFile.extension === '';
		if (isFolder) {
			// @ts-ignore - accessing private for debugging
			const trackedPaths = Array.from((this.selfEventTracker as any).trackedPaths?.keys() ?? []).filter((p: string) => p.includes(oldPath.split('/').pop() ?? ''));
			// @ts-ignore - accessing private for debugging
			const trackedPrefixes = Array.from((this.selfEventTracker as any).trackedPrefixes?.keys() ?? []);
			debugLog(`onRename FOLDER: oldPath=${oldPath}, relevant trackedPaths=${JSON.stringify(trackedPaths)}, trackedPrefixes=${JSON.stringify(trackedPrefixes)}`);
		}

		const newPathIgnored = this.selfEventTracker.shouldIgnore(tAbstractFile.path);
		const oldPathIgnored = this.selfEventTracker.shouldIgnore(oldPath);

		if (newPathIgnored || oldPathIgnored) {
			debugLog(`onRename: IGNORED by selfEventTracker (newPath: ${newPathIgnored}, oldPath: ${oldPathIgnored})`);
			// @ts-ignore - accessing private for debugging
			const currentTrackedPaths = Array.from((this.selfEventTracker as any).trackedPaths?.keys() ?? []);
			// @ts-ignore - accessing private for debugging
			const currentTrackedPrefixes = Array.from((this.selfEventTracker as any).trackedPrefixes?.keys() ?? []);
			this._debugAllRawEvents.push({
				event: `onRename: ${oldPath} → ${tAbstractFile.path}`,
				ignored: true,
				reason: `newPath: ${newPathIgnored}, oldPath: ${oldPathIgnored}`,
				debugTrackedPaths: currentTrackedPaths.filter((p: string) => p.includes('Pie') || p.includes('Berry')),
				debugTrackedPrefixes: currentTrackedPrefixes,
			});
			return;
		}

		const res = tryMakeVaultEventForFileRenamed(tAbstractFile, oldPath);
		if (res.isErr()) {
			debugLog(`onRename: FAILED to make event: ${res.error}`);
			this._debugAllRawEvents.push({
				event: `onRename: ${oldPath} → ${tAbstractFile.path}`,
				ignored: true,
				reason: `makeEvent failed: ${res.error}`,
			});
			return;
		}
		debugLog(`onRename: pushing event kind=${res.value.kind}`);
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
