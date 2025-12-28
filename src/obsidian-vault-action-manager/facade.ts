import type { Result } from "neverthrow";
import type { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { OpenedFileReader } from "./file-services/active-view/opened-file-reader";
import type { OpenedFileService } from "./file-services/active-view/opened-file-service";
import { OpenedFileService as OpenedFileServiceImpl } from "./file-services/active-view/opened-file-service";
import { TFileHelper } from "./file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./file-services/background/helpers/tfolder-helper";
import { ActionQueue } from "./impl/action-queue";
import { Dispatcher, type ExistenceChecker } from "./impl/dispatcher";
import { EventAdapter } from "./impl/event-adapter";
import { Executor } from "./impl/executor";
import { Reader } from "./impl/reader";
import { SelfEventTrackerLegacy } from "./impl/self-event-tracker";
import { makeSplitPath } from "./impl/split-path-and-system-path";
import type {
	DispatchResult,
	ObsidianVaultActionManager,
	Teardown,
	VaultEventHandler,
} from "./index";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

export class ObsidianVaultActionManagerImpl
	implements ObsidianVaultActionManager
{
	private readonly opened: OpenedFileService;
	private readonly reader: Reader;
	private readonly dispatcher: Dispatcher;
	private readonly selfEventTracker: SelfEventTrackerLegacy;
	private readonly actionQueue: ActionQueue;
	private readonly eventAdapter: EventAdapter;
	private readonly subscribers = new Set<VaultEventHandler>();
	private isListening = false;

	constructor(app: App) {
		const openedFileReader = new OpenedFileReader(app);
		this.opened = new OpenedFileServiceImpl(app, openedFileReader);
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
			this.opened,
			app.vault,
		);
		this.reader = new Reader(
			this.opened,
			tfileHelper,
			tfolderHelper,
			app.vault,
		);
		this.selfEventTracker = new SelfEventTrackerLegacy();
		const existenceChecker: ExistenceChecker = {
			exists: async (splitPath) => {
				if (splitPath.type === "Folder") {
					const result = await tfolderHelper.getFolder(splitPath);
					return result.isOk();
				}
				const result = await tfileHelper.getFile(splitPath);
				return result.isOk();
			},
		};
		this.dispatcher = new Dispatcher(
			executor,
			this.selfEventTracker,
			existenceChecker,
		);
		this.actionQueue = new ActionQueue(this.dispatcher);
		this.eventAdapter = new EventAdapter(app, this.selfEventTracker);
	}

	startListening(): void {
		if (this.isListening) return;
		this.isListening = true;
		this.eventAdapter.start(async (event) => {
			for (const handel of this.subscribers) {
				await handel(event);
			}
		});
	}

	subscribe(handler: VaultEventHandler): Teardown {
		this.subscribers.add(handler);
		if (!this.isListening) {
			this.startListening();
		}
		return () => {
			this.subscribers.delete(handler);
			if (this.subscribers.size === 0) {
				this.eventAdapter.stop();
				this.isListening = false;
			}
		};
	}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		// Route through ActionQueue (call stack pattern)
		// ActionQueue handles self-event registration and execution
		return this.actionQueue.dispatch(actions);
	}

	readContent(
		splitPathArg: SplitPathToMdFile,
	): Promise<Result<string, string>> {
		return this.reader.readContent(splitPathArg);
	}

	exists(splitPathArg: SplitPath): Promise<boolean> {
		return this.reader.exists(splitPathArg);
	}

	isInActiveView(splitPathArg: SplitPath): Promise<boolean> {
		return this.opened.isInActiveView(splitPathArg);
	}

	list(
		splitPathArg: SplitPathToFolder,
	): Promise<Result<SplitPath[], string>> {
		return this.reader.list(splitPathArg);
	}

	listAllFilesWithMdReaders(
		splitPathArg: SplitPathToFolder,
	): Promise<Result<SplitPathWithReader[], string>> {
		return this.reader.listAllFilesWithMdReaders(splitPathArg);
	}

	pwd(): Promise<Result<SplitPathToFile | SplitPathToMdFile, string>> {
		return this.reader.pwd();
	}

	getAbstractFile<SP extends SplitPath>(
		splitPathArg: SP,
	): Promise<Result<SP["type"] extends "Folder" ? TFolder : TFile, string>> {
		return this.reader.getAbstractFile(splitPathArg);
	}

	makeSplitPath(systemPath: string): SplitPath;
	makeSplitPath(tFile: TFile): SplitPathToFile | SplitPathToMdFile;
	makeSplitPath(tFolder: TFolder): SplitPathToFolder;
	makeSplitPath(tAbstractFile: TAbstractFile): SplitPath;
	makeSplitPath(input: string | TAbstractFile): SplitPath {
		if (typeof input === "string") {
			return makeSplitPath(input);
		}
		return makeSplitPath(input);
	}
}
