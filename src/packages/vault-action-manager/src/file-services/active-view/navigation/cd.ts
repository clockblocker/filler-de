import { err, ok, type Result } from "neverthrow";
import { type App, MarkdownView, type TFile } from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import { getErrorMessage } from "../../../../../../utils/get-error-message";
import { errorNoTFileFound, errorOpenFileFailed } from "../../../errors";
import { pathfinder } from "../../../helpers/pathfinder";
import type { SplitPathToAnyFile } from "../../../types/split-path";

export async function cd(app: App, file: TFile): Promise<Result<TFile, string>>;
export async function cd(
	app: App,
	file: SplitPathToAnyFile,
): Promise<Result<TFile, string>>;
export async function cd(
	app: App,
	file: TFile | SplitPathToAnyFile,
): Promise<Result<TFile, string>>;
export async function cd(
	app: App,
	file: TFile | SplitPathToAnyFile,
): Promise<Result<TFile, string>> {
	const tfile = isTFile(file)
		? file
		: pathfinder.abstractFromSplitPath(app.vault, file);

	if (!tfile) {
		const systemPath = pathfinder.systemPathFromSplitPath(
			file as SplitPathToAnyFile,
		);
		return err(errorNoTFileFound(systemPath));
	}

	try {
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(tfile);
		app.workspace.setActiveLeaf(leaf, { focus: true });

		// Using `as unknown` because `leftSplit.collapsed` is not in public Obsidian API types
		const leftSplit = app.workspace.leftSplit as unknown as {
			collapsed: boolean;
		} | null;

		const sidebarVisible = leftSplit && !leftSplit.collapsed;
		if (sidebarVisible) {
			const fileExplorerLeaves =
				app.workspace.getLeavesOfType("file-explorer");
			if (fileExplorerLeaves.length > 0) {
				// Using `as unknown` because `commands` is not in public Obsidian API types
				(
					app as unknown as {
						commands: {
							executeCommandById: (id: string) => void;
						};
					}
				).commands.executeCommandById(
					"file-explorer:reveal-active-file",
				);
			}
		}

		await waitForViewReady(app, tfile);
		return ok(tfile);
	} catch (error) {
		return err(errorOpenFileFailed(getErrorMessage(error)));
	}
}

function waitForViewReady(
	app: App,
	tfile: TFile,
	timeoutMs = 500,
): Promise<void> {
	return new Promise((resolve) => {
		const checkView = () => {
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			const hasContainer = view?.contentEl.querySelector(
				DomSelectors.CM_CONTENT_CONTAINER,
			);
			const pathMatch = view?.file?.path === tfile.path;
			return pathMatch && hasContainer;
		};

		if (checkView()) {
			resolve();
			return;
		}

		const observer = new MutationObserver(() => {
			if (checkView()) {
				observer.disconnect();
				resolve();
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });

		setTimeout(() => {
			observer.disconnect();
			resolve();
		}, timeoutMs);
	});
}

function isTFile(file: TFile | SplitPathToAnyFile): file is TFile {
	return "vault" in file && "stat" in file;
}
