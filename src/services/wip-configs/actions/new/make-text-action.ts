import { unwrapMaybeByThrowing } from "../../../../types/common-interface/maybe";
import { logError } from "../../../obsidian-services/helpers/issue-handlers";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";
// import { VaultCurrator } from '../../obsidian-services/managers/vault-currator';

export async function makeTextAction(
	services: Partial<TexfresserObsidianServices>,
): Promise<void> {
	const { openedFileService } = services;

	if (!openedFileService) {
		logError({
			description: "Missing required services for makeTextAction",
			location: "makeTextAction",
		});
		return;
	}

	const maybeFile = await openedFileService.getMaybeOpenedFile();
	const currentFile = unwrapMaybeByThrowing(maybeFile);

	// const textsManagerService = new VaultCurrator(openedFileService.getApp());

	// const hasEmptyMeta = await textsManagerService.hasEmptyMetaInfo(currentFile);
	// if (!hasEmptyMeta) {
	// 	return;
	// }

	try {
		const maybeContent = await openedFileService.getMaybeFileContent();
		const content = unwrapMaybeByThrowing(maybeContent);

		// const textStructure = await textsManagerService.createTextFromCurrentFile(
		// 	currentFile,
		// 	content
		// );

		// await openedFileService.openFile(textStructure.textRootFile);
	} catch (error) {
		logError({
			description: `Error creating text structure: ${error}`,
			location: "makeTextAction",
		});
	}
}
