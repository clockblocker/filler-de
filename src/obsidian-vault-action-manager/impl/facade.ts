import type { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { OpenedFileReader } from "../file-services/active-view/opened-file-reader";
import type { OpenedFileService } from "../file-services/active-view/opened-file-service";
import { OpenedFileService as OpenedFileServiceImpl } from "../file-services/active-view/opened-file-service";
import { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import type {
	DispatchResult,
	ObsidianVaultActionManager,
	Teardown,
	VaultEventHandler,
} from "../index";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import { BackgroundFileService } from "./background-file-service";
import { Dispatcher } from "./dispatcher";
import { EventAdapter } from "./event-adapter";
import { Executor } from "./executor";
import { Reader } from "./reader";
import { splitPath } from "./split-path";

export class ObsidianVaultActionManagerImpl
	implements ObsidianVaultActionManager
{
	private readonly opened: OpenedFileService;
	private readonly background: BackgroundFileService;
	private readonly reader: Reader;
	private readonly dispatcher: Dispatcher;
	private readonly eventAdapter: EventAdapter;
	private readonly subscribers = new Set<VaultEventHandler>();
	// TODO: Add SelfEventTracker and ActionQueue when implementing queue integration
	// private readonly selfEventTracker: SelfEventTracker;
	// private readonly actionQueue: ActionQueue;

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
		this.background = new BackgroundFileService(
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
		this.dispatcher = new Dispatcher(executor);
		this.eventAdapter = new EventAdapter(app);
	}

	subscribe(handler: VaultEventHandler): Teardown {
		this.subscribers.add(handler);
		if (this.subscribers.size === 1) {
			this.eventAdapter.start(async (event) => {
				for (const h of this.subscribers) {
					await h(event);
				}
			});
		}
		return () => {
			this.subscribers.delete(handler);
			if (this.subscribers.size === 0) this.eventAdapter.stop();
		};
	}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		// TODO: Register with self-event tracker before dispatch when implemented
		// this.selfEventTracker.register(actions);
		// Dispatch returns errors to caller (not throws)
		return this.dispatcher.dispatch(actions);
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
