import type { App, TAbstractFile } from "obsidian";
import type { BulkVaultEventHandler, Teardown } from "../../index";
import {
	decrementPending,
	incrementPending,
} from "../../internal/idle-tracker";
import { logger } from "../../internal/logger";
import { type VaultEvent, VaultEventKind } from "../../types/vault-event";
import { BulkEventAccumulator } from "./bulk-event-emmiter/batteries/event-accumulator";
import { collapseVaultEvents } from "./bulk-event-emmiter/batteries/processing-chain/collapse";
import { reduceRoots } from "./bulk-event-emmiter/batteries/processing-chain/reduce-roots";
import type { BulkVaultEvent } from "./bulk-event-emmiter/types/bulk/bulk-vault-event";
import { isDelete, isRename } from "./bulk-event-emmiter/types/bulk/helpers";
import type { SelfEventTracker } from "./self-event-tracker";
import {
	makeVaultEventForFileCreated,
	makeVaultEventForFileDeleted,
	tryMakeVaultEventForFileRenamed,
} from "./vault-events-for-events";

/**
 * The single intake for Obsidian Vault callbacks.
 *
 * Self Event attribution happens exactly once before user events enter the
 * window/collapse/Semantic Root pipeline. This module also owns subscription
 * lifecycle and handler completion.
 */
export class VaultObservation {
	private readonly accumulator: BulkEventAccumulator;
	private readonly subscribers = new Set<BulkVaultEventHandler>();
	private readonly listenerTeardowns: Array<() => void> = [];
	private readonly handlerWork = new Set<Promise<void>>();
	private readonly idleWaiters = new Set<() => void>();
	private listeningRequested = false;
	private listening = false;

	constructor(
		private readonly app: App,
		private readonly selfEvents: SelfEventTracker,
		options: { quietWindowMs?: number; maxWindowMs?: number } = {},
	) {
		this.accumulator = new BulkEventAccumulator(
			(window) => this.emitWindow(window),
			{
				maxWindowMs: options.maxWindowMs ?? 2000,
				quietWindowMs: options.quietWindowMs ?? 250,
			},
		);
	}

	start(): void {
		this.listeningRequested = true;
		this.startIfNeeded();
	}

	subscribe(handler: BulkVaultEventHandler): Teardown {
		this.subscribers.add(handler);
		this.startIfNeeded();

		return () => {
			this.subscribers.delete(handler);
			this.stopIfUnused();
		};
	}

	/** Flushes the current observation window for deterministic testing. */
	flushPending(): void {
		this.accumulator.flushNow();
	}

	/** Waits for all currently emitted subscriber work. */
	whenIdle(): Promise<void> {
		if (this.handlerWork.size === 0) return Promise.resolve();
		return new Promise((resolve) => this.idleWaiters.add(resolve));
	}

	private startIfNeeded(): void {
		if (
			!this.listeningRequested ||
			this.listening ||
			this.subscribers.size === 0
		) {
			return;
		}

		this.listening = true;
		const onCreate = this.app.vault.on("create", (file) =>
			this.onCreate(file),
		);
		const onRename = this.app.vault.on("rename", (file, oldPath) =>
			this.onRename(file, oldPath),
		);
		const onDelete = this.app.vault.on("delete", (file) =>
			this.onDelete(file),
		);

		this.listenerTeardowns.push(
			() => this.app.vault.offref(onCreate),
			() => this.app.vault.offref(onRename),
			() => this.app.vault.offref(onDelete),
		);
	}

	private stopIfUnused(): void {
		if (!this.listening || this.subscribers.size > 0) return;

		for (const teardown of this.listenerTeardowns.splice(0)) teardown();
		this.accumulator.clear();
		this.listening = false;
	}

	private emitWindow(window: {
		allObsidianEvents: VaultEvent[];
		debug: { startedAt: number; endedAt: number };
	}): void {
		if (this.subscribers.size === 0) return;

		const events = collapseVaultEvents(window.allObsidianEvents);
		const roots = reduceRoots(events);
		const bulk: BulkVaultEvent = {
			debug: {
				collapsedCount: countEvents(events),
				endedAt: window.debug.endedAt,
				reduced: {
					rootDeletes: roots.filter(isDelete).length,
					rootRenames: roots.filter(isRename).length,
				},
				startedAt: window.debug.startedAt,
				trueCount: countEvents(window.allObsidianEvents),
			},
			events,
			roots,
		};

		incrementPending();
		const work = Promise.all(
			[...this.subscribers].map(async (handler) => {
				try {
					await handler(bulk);
				} catch (error) {
					logger.error("[VaultObservation] Subscriber failed", error);
				}
			}),
		)
			.then(() => undefined)
			.finally(() => {
				this.handlerWork.delete(work);
				decrementPending();
				this.resolveIdleWaiters();
			});
		this.handlerWork.add(work);
	}

	private resolveIdleWaiters(): void {
		if (this.handlerWork.size > 0) return;
		const waiters = [...this.idleWaiters];
		this.idleWaiters.clear();
		for (const resolve of waiters) resolve();
	}

	private onCreate(file: TAbstractFile): void {
		if (this.selfEvents.shouldIgnore(file.path)) return;
		this.accumulator.push(makeVaultEventForFileCreated(file));
	}

	private onRename(file: TAbstractFile, oldPath: string): void {
		const newPathIsSelf = this.selfEvents.shouldIgnore(file.path);
		const oldPathIsSelf = this.selfEvents.shouldIgnore(oldPath);
		if (newPathIsSelf && oldPathIsSelf) return;

		const event = tryMakeVaultEventForFileRenamed(file, oldPath);
		if (event.isOk()) this.accumulator.push(event.value);
	}

	private onDelete(file: TAbstractFile): void {
		if (this.selfEvents.shouldIgnore(file.path)) return;
		this.accumulator.push(makeVaultEventForFileDeleted(file));
	}
}

function countEvents(events: readonly VaultEvent[]) {
	let renames = 0;
	let creates = 0;
	let deletes = 0;

	for (const event of events) {
		switch (event.kind) {
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
