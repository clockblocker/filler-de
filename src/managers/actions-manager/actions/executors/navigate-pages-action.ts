import { logError } from "../../../obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../obsidian/vault-action-manager/types/split-path";

export type NavigatePagePayload = {
	direction: "prev" | "next";
	currentFilePath: SplitPathToMdFile;
};

export type NavigatePageDeps = {
	getAdjacentPage: (
		path: SplitPathToMdFile,
		direction: -1 | 1,
	) => SplitPathToMdFile | null;
	navigate: (path: SplitPathToMdFile) => Promise<void>;
};

export async function navigatePageAction(
	payload: NavigatePagePayload,
	deps: NavigatePageDeps,
): Promise<void> {
	const { direction, currentFilePath } = payload;
	const { getAdjacentPage, navigate } = deps;

	try {
		const dir = direction === "prev" ? -1 : 1;
		const targetPage = getAdjacentPage(currentFilePath, dir);

		if (targetPage) {
			await navigate(targetPage);
		}
	} catch (error) {
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: "navigatePageAction",
		});
	}
}
