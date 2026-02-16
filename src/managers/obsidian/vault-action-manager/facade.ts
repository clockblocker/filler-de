import type { Result } from "neverthrow";
import type { App } from "obsidian";
import { logger } from "../../../utils/logger";
import { ActiveFileService } from "./file-services/active-view/active-file-service";
import { SelectionService } from "./file-services/active-view/selection-service";
import { TFileHelper } from "./file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./file-services/background/helpers/tfolder-helper";
import { ActionQueue } from "./impl/actions-processing/action-queue";
import type {
	DispatcherDebugState,
	ExistenceChecker,
} from "./impl/actions-processing/dispatcher";
import { Dispatcher } from "./impl/actions-processing/dispatcher";
import { Executor } from "./impl/actions-processing/executor";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/common/split-path-and-system-path";
import { BulkEventEmmiter } from "./impl/event-processing/bulk-event-emmiter/bulk-event-emmiter";
import { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import { SingleEventEmmiter } from "./impl/event-processing/single-event-emmiter";
import { VaultReader } from "./impl/vault-reader";
import type {
	BulkVaultEventHandler,
	DispatchResult,
	Teardown,
	VaultActionManager,
	VaultEventHandler,
} from "./index";
import type {
	AnySplitPath,
	SplitPathToAnyFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

export class VaultActionManagerImpl implements VaultActionManager {
	private readonly active: ActiveFileService;
	private readonly reader: VaultReader;
	private readonly dispatcher: Dispatcher;
	private readonly selfEventTracker: SelfEventTracker;
	private readonly actionQueue: ActionQueue;
	private readonly singleEventEmmiter: SingleEventEmmiter;
	private readonly subscribers = new Set<VaultEventHandler>();

	private readonly bulkEventEmmiter: BulkEventEmmiter;
	private readonly bulkSubscribers = new Set<BulkVaultEventHandler>();

	private isSingleListening = false;
	private isBulkListening = false;
	private listeningRequested = false;
	private readonly app: App;

	private readonly _selection: SelectionService;

	constructor(app: App) {
		this.app = app;
		this.active = new ActiveFileService(app);
		const tfileHelper = new TFileHelper({
			fileManager: app.fileManager,
			vault: app.vault,
		});
		const tfolderHelper = new TFolderHelper({
			fileManager: app.fileManager,
			vault: app.vault,
		});
		const executor = new Executor(
			tfileHelper,
			tfolderHelper,
			this.active,
			app.vault,
		);
		this.reader = new VaultReader(
			this.active,
			tfileHelper,
			tfolderHelper,
			app.vault,
		);
		this.selfEventTracker = new SelfEventTracker();
		const existenceChecker: ExistenceChecker = {
			exists: (splitPath) => {
				if (splitPath.kind === "Folder") {
					return tfolderHelper.getFolder(splitPath).isOk();
				}
				return tfileHelper.getFile(splitPath).isOk();
			},
		};
		this.dispatcher = new Dispatcher(
			executor,
			this.selfEventTracker,
			existenceChecker,
		);
		this.actionQueue = new ActionQueue(this.dispatcher);
		this.singleEventEmmiter = new SingleEventEmmiter(
			app,
			this.selfEventTracker,
		);
		this.bulkEventEmmiter = new BulkEventEmmiter(
			app,
			this.selfEventTracker,
		);
		this._selection = new SelectionService(this.active);
	}

	startListening(): void {
		this.listeningRequested = true;

		// If subscriptions already exist, start immediately.
		if (this.subscribers.size > 0) this.startSingleIfNeeded();
		if (this.bulkSubscribers.size > 0) this.startBulkIfNeeded();
	}

	private startSingleIfNeeded() {
		if (this.isSingleListening) return;
		this.isSingleListening = true;
		this.singleEventEmmiter.start(async (event) => {
			for (const h of this.subscribers) await h(event);
		});
	}

	private stopSingleIfNeeded() {
		if (!this.isSingleListening) return;
		if (this.subscribers.size > 0) return;
		this.singleEventEmmiter.stop();
		this.isSingleListening = false;
	}

	private startBulkIfNeeded() {
		if (this.isBulkListening) return;
		this.isBulkListening = true;

		this.bulkEventEmmiter.start(async (bulk) => {
			for (const h of this.bulkSubscribers) {
				await h(bulk);
			}
		});
	}

	private stopBulkIfNeeded() {
		if (!this.isBulkListening) return;
		if (this.bulkSubscribers.size > 0) return;
		this.bulkEventEmmiter.stop();
		this.isBulkListening = false;
	}

	subscribeToSingle(handler: VaultEventHandler): Teardown {
		this.subscribers.add(handler);
		if (this.listeningRequested) this.startSingleIfNeeded();

		return () => {
			this.subscribers.delete(handler);
			this.stopSingleIfNeeded();
		};
	}

	subscribeToBulk(handler: BulkVaultEventHandler): Teardown {
		this.bulkSubscribers.add(handler);
		if (this.listeningRequested) this.startBulkIfNeeded();

		return () => {
			this.bulkSubscribers.delete(handler);
			this.stopBulkIfNeeded();
		};
	}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		// Route through ActionQueue (call stack pattern)
		// ActionQueue handles self-event registration and execution
		return this.actionQueue.dispatch(actions);
	}

	/**
	 * Wait until all registered paths have been processed by Obsidian (via events).
	 * Used by E2E tests to ensure files are visible before assertions.
	 * Also verifies files are queryable via vault API after events fire.
	 */
	async waitForObsidianEvents(): Promise<void> {
		// Capture file paths NOW (before waiting) to ensure we get all files from all dispatches
		const filePathsToVerify =
			this.selfEventTracker.getRegisteredFilePaths();
		await this.selfEventTracker.waitForAllRegistered();
		// After events fired, verify files are queryable
		if (filePathsToVerify.length > 0) {
			await this.verifyFilesQueryable(filePathsToVerify);
		}
	}

	/**
	 * Verify that file paths are queryable via Obsidian vault API.
	 * Polls with short intervals since events already fired.
	 * Waits up to 10 seconds to allow Obsidian to fully register files.
	 * Uses exponential backoff for efficiency.
	 */
	private async verifyFilesQueryable(
		filePaths: readonly string[],
	): Promise<void> {
		if (filePaths.length === 0) {
			return;
		}

		const initialDelayMs = 100;
		const maxTimeoutMs = 10000;
		const startTime = Date.now();

		// Small initial delay to let Obsidian process events
		await new Promise((resolve) => setTimeout(resolve, initialDelayMs));

		let intervalMs = 50;
		let consecutiveChecks = 0;

		while (Date.now() - startTime < maxTimeoutMs) {
			const missingPaths: string[] = [];
			for (const path of filePaths) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (!file) {
					missingPaths.push(path);
				}
			}

			if (missingPaths.length === 0) {
				return;
			}

			// Exponential backoff: start with 50ms, increase gradually
			consecutiveChecks++;
			if (consecutiveChecks > 10) {
				intervalMs = Math.min(intervalMs * 1.2, 200);
			}

			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}

		// Final check - if still missing, log warning (tests will handle with their own polling)
		const stillMissing: string[] = [];
		for (const path of filePaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!file) {
				stillMissing.push(path);
			}
		}

		if (stillMissing.length > 0) {
			logger.warn(
				`[VaultActionManager] Files not queryable after ${maxTimeoutMs}ms:`,
				stillMissing,
			);
		}
	}

	readContent(
		splitPathArg: SplitPathToMdFile,
	): Promise<Result<string, string>> {
		return this.reader.readContent(splitPathArg);
	}

	exists(splitPathArg: AnySplitPath): boolean {
		return this.reader.exists(splitPathArg);
	}

	findByBasename(
		basename: string,
		opts?: { folder?: SplitPathToFolder },
	): SplitPathToMdFile[] {
		return this.reader.findByBasename(basename, opts);
	}

	resolveLinkpathDest(
		linkpath: string,
		from: SplitPathToMdFile,
	): SplitPathToMdFile | null {
		const sourcePath = makeSystemPathForSplitPath(from);
		const file = this.app.metadataCache.getFirstLinkpathDest(
			linkpath,
			sourcePath,
		);
		if (!file) return null;

		const splitPath = makeSplitPath(file);
		return splitPath.kind === "MdFile" ? splitPath : null;
	}

	isInActiveView(splitPathArg: AnySplitPath): boolean {
		return this.active.isInActiveView(splitPathArg);
	}

	list(splitPathArg: SplitPathToFolder): Result<AnySplitPath[], string> {
		return this.reader.list(splitPathArg);
	}

	listAllFilesWithMdReaders(
		splitPathArg: SplitPathToFolder,
	): Result<SplitPathWithReader[], string> {
		return this.reader.listAllFilesWithMdReaders(splitPathArg);
	}

	pwd(): Result<SplitPathToAnyFile, string> {
		return this.active.pwd();
	}

	mdPwd(): SplitPathToMdFile | null {
		return this.active.mdPwd();
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Active file operations (high-level, no TFile leakage)
	// ─────────────────────────────────────────────────────────────────────────

	getOpenedContent(): Result<string, string> {
		return this.active.getContent();
	}

	async cd(splitPath: SplitPathToMdFile): Promise<Result<void, string>> {
		const result = await this.active.cd(splitPath);
		return result.map(() => undefined);
	}

	get activeFileService(): ActiveFileService {
		return this.active;
	}

	get selection(): SelectionService {
		return this._selection;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Debug API - for testing multi-batch scenarios
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Reset all dispatcher debug state. Call at the start of each test
	 * to get clean traces that don't include state from previous tests.
	 */
	resetDebugState(): void {
		this.dispatcher.resetDebugState();
		this.bulkEventEmmiter.resetDebugState();
	}

	/**
	 * Get accumulated debug state across all dispatch batches since last reset.
	 * Includes execution trace, sorted actions per batch, and error info.
	 */
	getDebugState(): DispatcherDebugState {
		return this.dispatcher.getDebugState();
	}

	/**
	 * Get self-event tracker state for debugging event filtering.
	 */
	_getDebugSelfTrackerState(): {
		trackedPaths: string[];
		trackedPrefixes: string[];
	} {
		// Accessing private Maps for debugging
		const tracker = this.selfEventTracker as unknown as {
			trackedPaths?: Map<string, unknown>;
			trackedPrefixes?: Map<string, unknown>;
		};
		return {
			trackedPaths: Array.from(tracker.trackedPaths?.keys() ?? []),
			trackedPrefixes: Array.from(tracker.trackedPrefixes?.keys() ?? []),
		};
	}

	/**
	 * Get raw events from BulkEventEmmiter for debugging event processing.
	 */
	_getDebugAllRawEvents(): Array<{
		event: string;
		ignored: boolean;
		reason?: string;
	}> {
		return this.bulkEventEmmiter._debugAllRawEvents ?? [];
	}
}
