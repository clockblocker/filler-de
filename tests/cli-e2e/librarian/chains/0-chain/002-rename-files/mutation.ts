import { renamePath, waitForIdle } from "../../../../utils";

export async function performMutation002(): Promise<void> {
	// Rename Pie -> Fish-Pie (do this FIRST to avoid dragging Berry)
	await renamePath("Library/Recipe/Pie", "Library/Recipe/Fish-Pie");
	await waitForIdle();

	// Rename Berry_Pie -> Berry-Pie
	await renamePath("Library/Recipe/Berry_Pie", "Library/Recipe/Berry-Pie");
	await waitForIdle();
}
