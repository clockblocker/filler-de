import type { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { OpenedFileReader } from "./file-services/active-view/opened-file-reader";
import type { OpenedFileService } from "./file-services/active-view/opened-file-service";
import { OpenedFileService as OpenedFileServiceImpl } from "./file-services/active-view/opened-file-service";
import { TFileHelper } from "./file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./file-services/background/helpers/tfolder-helper";
import { ActionQueue } from "./impl/action-queue";
import { BackgroundFileServiceLegacy } from "./impl/background-file-service";
import { Dispatcher } from "./impl/dispatcher";
import { EventAdapter } from "./impl/event-adapter";
import { Executor } from "./impl/executor";
import { Reader } from "./impl/reader";
import { SelfEventTrackerLegacy } from "./impl/self-event-tracker";
import { splitPath } from "./impl/split-path";
import type {
	DispatchResult,
	ObsidianVaultActionManager,
	Teardown,
	VaultEventHandlerLegacy,
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
	private readonly background: BackgroundFileServiceLegacy;
	private readonly reader: Reader;
	private readonly dispatcher: Dispatcher;
	private readonly selfEventTracker: SelfEventTrackerLegacy;
	private readonly actionQueue: ActionQueue;
	private readonly eventAdapter: EventAdapter;
	private readonly subscribers = new Set<VaultEventHandlerLegacy>();
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
		this.background = new BackgroundFileServiceLegacy(
			tfileHelper,
			tfolderHelper,
			app.vault,
		);
		const executor = new Executor(
			tfileHelper,
			tfolderHelper,
			this.opened,
			app.vault,
		);
		this.reader = new Reader(this.opened, this.background);
		this.selfEventTracker = new SelfEventTrackerLegacy();
		this.dispatcher = new Dispatcher(executor, this.selfEventTracker);
		this.actionQueue = new ActionQueue(this.dispatcher);
		this.eventAdapter = new EventAdapter(app, this.selfEventTracker);
	}

	startListening(): void {
		if (this.isListening) return;
		this.isListening = true;
		this.eventAdapter.start(async (event) => {
			for (const h of this.subscribers) {
				await h(event);
			}
		});
	}

	subscribe(handler: VaultEventHandlerLegacy): Teardown {
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

	readContent(splitPathArg: SplitPathToMdFile): Promise<string> {
		return this.reader.readContent(splitPathArg);
	}

	exists(splitPathArg: SplitPath): Promise<boolean> {
		return this.reader.exists(splitPathArg);
	}

	isInActiveView(splitPathArg: SplitPath): Promise<boolean> {
		return this.opened.isInActiveView(splitPathArg);
	}

	list(splitPathArg: SplitPathToFolder): Promise<SplitPath[]> {
		return this.reader.list(splitPathArg);
	}

	listAllFilesWithMdReaders(
		splitPathArg: SplitPathToFolder,
	): Promise<SplitPathWithReader[]> {
		return this.reader.listAllFilesWithMdReaders(splitPathArg);
	}

	pwd(): Promise<SplitPathToFile | SplitPathToMdFile> {
		return this.reader.pwd();
	}

	getAbstractFile<SP extends SplitPath>(
		splitPathArg: SP,
	): Promise<SP["type"] extends "Folder" ? TFolder : TFile> {
		return this.reader.getAbstractFile(splitPathArg) as Promise<
			SP["type"] extends "Folder" ? TFolder : TFile
		>;
	}

	splitPath(systemPath: string): SplitPath;
	splitPath(tFile: TFile): SplitPathToFile | SplitPathToMdFile;
	splitPath(tFolder: TFolder): SplitPathToFolder;
	splitPath(tAbstractFile: TAbstractFile): SplitPath;
	splitPath(input: string | TAbstractFile): SplitPath {
		if (typeof input === "string") {
			return splitPath(input);
		}
		return splitPath(input);
	}
}
