import { toggleCodexCheckbox, waitForIdle } from "../../../../utils";

export async function performMutation008(): Promise<void> {
	// Toggle "Steps" checkbox in Fish codex: unchecked → checked (Done)
	await toggleCodexCheckbox(
		"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		"[[Steps-Fish-Pie-Recipe|Steps]]",
		false, // wasChecked = false → user wants to check → Done
	);
	await waitForIdle();
}
