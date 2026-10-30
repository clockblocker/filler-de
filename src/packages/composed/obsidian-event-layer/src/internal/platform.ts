/** Whether Obsidian runs on macOS, where Cmd is the modifier Ctrl is elsewhere. */
export function onMacOS(): boolean {
	return (
		typeof navigator !== "undefined" &&
		navigator.platform.toLowerCase().includes("mac")
	);
}

/**
 * Whether `evt` holds the platform's modifier: Cmd on macOS, where
 * Ctrl-click opens the context menu, and Ctrl elsewhere.
 */
export function holdsMod(
	evt: Pick<MouseEvent, "ctrlKey" | "metaKey">,
): boolean {
	return onMacOS() ? evt.metaKey : evt.ctrlKey;
}
