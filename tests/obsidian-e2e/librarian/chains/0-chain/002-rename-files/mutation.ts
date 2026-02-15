/// <reference types="@wdio/globals/types" />
import { waitForIdle } from "../../../../support/api/idle";
import { renamePath } from "../../../../support/api/vault-ops";

export async function performMutation002(): Promise<void> {
	// Rename Pie -> Fish-Pie (do this FIRST to avoid dragging Berry)
	const pieResult = await renamePath(
		"Library/Recipe/Pie",
		"Library/Recipe/Fish-Pie",
	);
	if (pieResult.isErr()) {
		throw new Error(`Failed to rename Pie: ${pieResult.error}`);
	}
	await waitForIdle();

	// Rename Berry_Pie -> Berry-Pie
	const berryResult = await renamePath(
		"Library/Recipe/Berry_Pie",
		"Library/Recipe/Berry-Pie",
	);
	if (berryResult.isErr()) {
		throw new Error(`Failed to rename Berry_Pie: ${berryResult.error}`);
	}
	await waitForIdle();
}
