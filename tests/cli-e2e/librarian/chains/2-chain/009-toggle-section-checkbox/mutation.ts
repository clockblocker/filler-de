import { toggleCodexCheckbox, waitForIdle } from "../../../../utils";

export async function performMutation009(): Promise<void> {
	// Toggle "Berry" section checkbox in Pie codex: unchecked → checked (Done)
	// This should propagate Done status to all Berry scrolls
	await toggleCodexCheckbox(
		"Library/Recipe/Pie/__-Pie-Recipe.md",
		"[[__-Berry-Pie-Recipe|Berry]]",
		false, // wasChecked = false → user wants to check → Done
	);
	await waitForIdle();
}
