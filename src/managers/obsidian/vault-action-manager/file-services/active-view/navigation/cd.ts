import { err, ok, type Result } from "neverthrow";
import type { App, TFile } from "obsidian";
import { errorNoTFileFound, errorOpenFileFailed } from "../../../errors";
import { pathfinder } from "../../../helpers/pathfinder";
import type { SplitPathToAnyFile } from "../../../types/split-path";
import { waitForViewReady } from "../view-utils/wait-for-view-ready";

function isTFile(file: TFile | SplitPathToAnyFile): file is TFile {
	return "vault" in file && "stat" in file;
}

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
		return err(
			errorOpenFileFailed(
				error instanceof Error ? error.message : String(error),
			),
		);
	}
}
