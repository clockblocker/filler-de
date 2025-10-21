import type { TexfresserObsidianServices } from "../../obsidian-services/interface";
import { executeButtonAction } from "./execute-button-actions";
import { handleLinkElementClicked } from "./handle-link-element-clicked";

export const makeClickListener =
  (services: TexfresserObsidianServices) => (evt: PointerEvent) => {
    const target = evt.target as HTMLElement;

    // Handle toolbar/overlay generic buttons
    const buttonElement = target.closest("button");
    console.log("[click-listener] target", target);
    console.log("[click-listener] buttonElement", buttonElement);
    console.log("[click-listener] target tagName", target.tagName);
    console.log("[click-listener] target className", target.className);

    if (buttonElement) {
      console.log("[click-listener] Found button, executing action");
      executeButtonAction({ buttonElement, services });
    }

    if (target.tagName === "A") {
      handleLinkElementClicked({ linkElement: target });
    }
  };
