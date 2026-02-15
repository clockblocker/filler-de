/// <reference types="@wdio/globals/types" />
import { deletePath } from "../../../../support/api/vault-ops";

export async function performMutation004(): Promise<void> {
	// Delete a file from Pie/Fish folder
	const deleteResult = await deletePath(
		"Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
	);
	if (deleteResult.isErr()) {
		throw new Error(`Failed to delete file: ${deleteResult.error}`);
	}
}
