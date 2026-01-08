import { logError } from "../../../../managers/obsidian/vault-action-manager/helpers/issue-handlers";
import { unwrapMaybeLegacyByThrowing } from "../../../../types/common-interface/maybe";
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

	const maybeFile = await openedFileService.getMaybeLegacyOpenedTFile();
	const currentFile = unwrapMaybeLegacyByThrowing(maybeFile);

	// const textsManagerService = new VaultCurrator(openedFileService.getApp());

	// const hasEmptyMeta = await textsManagerService.hasEmptyMetaInfo(currentFile);
	// if (!hasEmptyMeta) {
	// 	return;
	// }

	try {
		const maybeContent = await openedFileService.getMaybeLegacyContent();
		const content = unwrapMaybeLegacyByThrowing(maybeContent);

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
