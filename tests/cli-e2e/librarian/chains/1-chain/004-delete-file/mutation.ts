import { deletePath } from "../../../../utils";

export async function performMutation004(): Promise<void> {
	// Delete a file from Pie/Fish folder
	await deletePath("Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md");
}
