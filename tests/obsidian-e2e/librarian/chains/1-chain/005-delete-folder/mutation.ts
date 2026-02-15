/// <reference types="@wdio/globals/types" />
import { deletePath } from "../../../../support/api/vault-ops";

export async function performMutation005(): Promise<void> {
	// Delete the entire Pho_Bo folder
	const deleteResult = await deletePath("Library/Recipe/Soup/Pho_Bo");
	if (deleteResult.isErr()) {
		throw new Error(`Failed to delete folder: ${deleteResult.error}`);
	}
}
