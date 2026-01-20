import {
	getNextPageSplitPath,
	getPrevPageSplitPath,
} from "../../../../commanders/librarian/bookkeeper/page-codec";
import {
	logError,
	logWarning,
} from "../../../../managers/obsidian/vault-action-manager/helpers/issue-handlers";
import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export async function navigatePageAction(
	services: Partial<TexfresserObsidianServices>,
	direction: "prev" | "next",
): Promise<void> {
	console.log("[navigatePageAction] called with direction:", direction);
	const { vaultActionManager } = services;

	if (!vaultActionManager) {
		console.error("[navigatePageAction] Missing vaultActionManager");
		return;
	}

	const pwdResult = await vaultActionManager.pwd();
	console.log("[navigatePageAction] pwdResult:", JSON.stringify(pwdResult));
	if (pwdResult.isErr()) {
		console.error("[navigatePageAction] pwd error:", pwdResult.error);
		logError({
			description: `Error getting current file: ${pwdResult.error}`,
			location: "navigatePageAction",
		});
		return;
	}

	try {
		const currentPath = pwdResult.value as SplitPathToMdFile;
		console.log("[navigatePageAction] currentPath:", JSON.stringify(currentPath));

		const targetPage =
			direction === "prev"
				? getPrevPageSplitPath(currentPath)
				: getNextPageSplitPath(currentPath);

		console.log("[navigatePageAction] targetPage:", JSON.stringify(targetPage));

		if (targetPage) {
			console.log("[navigatePageAction] calling cd()...");
			const cdResult = await vaultActionManager.cd(targetPage);
			console.log("[navigatePageAction] cd result:", JSON.stringify(cdResult));
		} else {
			console.warn("[navigatePageAction] No target page found");
			logWarning({
				description: `No ${direction} page found`,
				location: "navigatePageAction",
			});
		}
	} catch (error) {
		console.error("[navigatePageAction] Exception:", error);
		logError({
			description: `Error navigating to ${direction} page: ${error}`,
			location: "navigatePageAction",
		});
	}
}
