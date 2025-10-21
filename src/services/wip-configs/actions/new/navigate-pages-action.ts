import { unwrapMaybe } from "../../../../types/general";
import {
  logError,
  logWarning,
} from "../../../obsidian-services/helpers/issue-handlers";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export async function navigatePagesAction(
  services: Partial<TexfresserObsidianServices>,
  direction: "prev" | "next",
): Promise<void> {
  const { openedFileService } = services;

  if (!openedFileService) {
    console.error("Missing required services for navigatePagesAction");
    return;
  }

  const maybeFile = await openedFileService.getMaybeOpenedFile();
  const currentFile = unwrapMaybe(maybeFile);

  // const textsManagerService = new VaultCurrator(openedFileService.getApp());

  try {
    const targetPage: any = null;

    if (direction === "prev") {
      // targetPage = await textsManagerService.getPreviousPage(currentFile);
    } else {
      // targetPage = await textsManagerService.getNextPage(currentFile);
    }

    if (targetPage) {
      await openedFileService.openFile(targetPage);
    } else {
      logWarning({
        description: `No ${direction} page found`,
        location: "navigatePagesAction",
      });
    }
  } catch (error) {
    logError({
      description: `Error navigating to ${direction} page: ${error}`,
      location: "navigatePagesAction",
    });
  }
}
