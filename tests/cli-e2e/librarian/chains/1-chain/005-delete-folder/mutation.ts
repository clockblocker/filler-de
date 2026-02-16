import { deletePath } from "../../../../utils";

export async function performMutation005(): Promise<void> {
	// Delete the entire Pho_Bo folder
	await deletePath("Library/Recipe/Soup/Pho_Bo");
}
