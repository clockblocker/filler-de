import { createFile, waitForIdle } from "../../../../utils";

export async function performMutation007(): Promise<void> {
	// Create a new file WITHOUT suffix in a nested library folder
	const pathNoSuffix = "Library/Recipe/Soup/Ramen/NewScroll.md";
	await createFile(
		pathNoSuffix,
		"# NewScroll\n\nThis is a new scroll without suffix.",
	);

	// Wait for healing to rename: NewScroll.md -> NewScroll-Ramen-Soup-Recipe.md
	await waitForIdle();
}
