import type { App, TAbstractFile, TFile, TFolder } from "obsidian";
import type {
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
import { OpenedFileService } from "./opened-file-service";
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

	constructor(app: App) {
		this.opened = new OpenedFileService(app);
		this.background = new BackgroundFileService(app);
		const executor = new Executor(this.background, this.opened);
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

	async dispatch(actions: readonly VaultAction[]): Promise<void> {
		await this.dispatcher.dispatch(actions);
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
		return splitPath(input);
	}
}
