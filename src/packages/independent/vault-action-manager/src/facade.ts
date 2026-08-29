import type { Result } from "neverthrow";
import type { App } from "obsidian";
import { ActiveFileService } from "./file-services/active-view/active-file-service";
import type { SelectionInfo } from "./file-services/active-view/selection-service";
import { TFileHelper } from "./file-services/background/helpers/tfile-helper";
import { TFolderHelper } from "./file-services/background/helpers/tfolder-helper";
import { MarkdownFileAccess } from "./file-services/markdown-file-access";
import {
	DispatchBatchCoordinator,
	type ExistenceChecker,
} from "./impl/actions-processing/dispatch-batch";
import { Executor } from "./impl/actions-processing/executor";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "./impl/common/split-path-and-system-path";
import { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import { VaultObservation } from "./impl/event-processing/vault-observation";
import { VaultReader } from "./impl/vault-reader";
import type {
	BulkVaultEventHandler,
	DispatchResult,
	Teardown,
	VaultActionManager,
} from "./index";
import { VaultActionManagerTestingAdapter } from "./testing-adapter";
import type { ReadContentError } from "./types/read-content-error";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathWithReader,
} from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

const testingAdapters = new WeakMap<object, VaultActionManagerTestingAdapter>();

class VaultActionManagerImpl implements VaultActionManager {
	private readonly markdownFiles: MarkdownFileAccess;
	private readonly reader: VaultReader;
	private readonly dispatches: DispatchBatchCoordinator;
	private readonly observation: VaultObservation;

	constructor(private readonly app: App) {
		const activeEditor = new ActiveFileService(app);
		const tfileHelper = new TFileHelper({
			fileManager: app.fileManager,
			vault: app.vault,
		});
		const tfolderHelper = new TFolderHelper({
			fileManager: app.fileManager,
			vault: app.vault,
		});

		this.markdownFiles = new MarkdownFileAccess(
			activeEditor,
			tfileHelper,
			app.vault,
		);
		this.reader = new VaultReader(
			this.markdownFiles,
			tfileHelper,
			tfolderHelper,
			app.vault,
		);

		const selfEvents = new SelfEventTracker();
		const existenceChecker: ExistenceChecker = {
			exists: (splitPath) => {
				if (splitPath.kind === "Folder") {
					return tfolderHelper.getFolder(splitPath).isOk();
				}
				return tfileHelper.getFile(splitPath).isOk();
			},
		};
		const executor = new Executor(
			tfileHelper,
			tfolderHelper,
			this.markdownFiles,
			app.vault,
		);

		this.dispatches = new DispatchBatchCoordinator(
			executor,
			selfEvents,
			existenceChecker,
		);
		this.observation = new VaultObservation(app, selfEvents);

		testingAdapters.set(
			this,
			new VaultActionManagerTestingAdapter(
				app,
				this.dispatches,
				this.observation,
				selfEvents,
			),
		);
	}

	startListening(): void {
		this.observation.start();
	}

	subscribeToBulk(handler: BulkVaultEventHandler): Teardown {
		return this.observation.subscribe(handler);
	}

	dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		return this.dispatches.dispatch(actions);
	}

	readContent(
		splitPath: SplitPathToMdFile,
	): Promise<Result<string, ReadContentError>> {
		return this.reader.readContent(splitPath);
	}

	exists(splitPath: AnySplitPath): boolean {
		return this.reader.exists(splitPath);
	}

	findByBasename(
		basename: string,
		options?: { folder?: SplitPathToFolder },
	): SplitPathToMdFile[] {
		return this.reader.findByBasename(basename, options);
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

	list(splitPath: SplitPathToFolder): Result<AnySplitPath[], string> {
		return this.reader.list(splitPath);
	}

	listAllFilesWithMdReaders(
		splitPath: SplitPathToFolder,
	): Result<SplitPathWithReader[], string> {
		return this.reader.listAllFilesWithMdReaders(splitPath);
	}

	mdPwd(): SplitPathToMdFile | null {
		return this.markdownFiles.activeMdPath();
	}

	getOpenedContent(): Result<string, string> {
		return this.markdownFiles.openedContent();
	}

	getSelectionInfo(): SelectionInfo | null {
		return this.markdownFiles.selectionInfo();
	}

	getSelectionText(): string | null {
		return this.markdownFiles.selectionText();
	}

	cd(splitPath: SplitPathToMdFile): Promise<Result<void, string>> {
		return this.markdownFiles.open(splitPath);
	}

	scrollOpenedFileToLine(line: number): void {
		this.markdownFiles.scrollOpenedFileToLine(line);
	}
}

/** Builds the production manager and its testing adapter over one object graph. */
export function createVaultActionManager(app: App): {
	manager: VaultActionManager;
	testing: VaultActionManagerTestingAdapter;
} {
	const manager = new VaultActionManagerImpl(app);
	const testing = testingAdapters.get(manager);
	if (!testing) {
		throw new Error("Vault Action Manager testing adapter was not created");
	}
	return { manager, testing };
}
