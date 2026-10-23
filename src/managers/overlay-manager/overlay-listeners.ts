import { Effect } from "effect";
import { PluginHost } from "../obsidian/host/plugin-host";
import type { OverlayManager } from "./overlay-manager";

/**
 * What the overlay hears from the workspace, for as long as the caller's
 * scope is open: a file opened or the layout changed places the toolbars
 * anew, a scroll in any pane hides the selection toolbar, and the editor
 * menu offers "Split into pages".
 */
export const listenForOverlay = Effect.fnUntraced(function* (
	overlay: Pick<
		OverlayManager,
		"refreshToolbars" | "hideSelectionToolbar" | "onEditorMenu"
	>,
) {
	const host = yield* PluginHost;
	yield* host.onWorkspace("file-open", () => overlay.refreshToolbars());
	yield* host.onWorkspace("layout-change", () => overlay.refreshToolbars());
	// Captured, so a scroll inside any pane reaches it.
	yield* host.onDom(
		window,
		"scroll",
		() => overlay.hideSelectionToolbar(),
		true,
	);
	yield* host.onWorkspace("editor-menu", (menu) =>
		overlay.onEditorMenu(menu),
	);
});
