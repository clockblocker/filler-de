/**
 * State machine to prevent race conditions during navigation.
 * Tracks whether we're in a plugin-initiated nav vs external nav.
 *
 * See: src/documentaion/insights-about-obsidian-quirks/overlay-navigation-race.md
 */
export class NavigationState {
	private state: "idle" | "navigating" = "idle";
	private pendingPath: string | null = null;
	private isPlugin = false;

	/**
	 * Called before plugin's cd() opens a file.
	 * Marks navigation as plugin-initiated.
	 */
	startPluginNav(path: string): void {
		this.state = "navigating";
		this.pendingPath = path;
		this.isPlugin = true;
	}

	/**
	 * Called on file-open for external navigation (wikilinks, file explorer).
	 * No-op if plugin nav already in progress.
	 */
	startExternalNav(path: string): void {
		if (this.state === "navigating") {
			return;
		}
		this.state = "navigating";
		this.pendingPath = path;
		this.isPlugin = false;
	}

	/**
	 * Called when navigation completes (file-ready or layout-change handled).
	 * Returns the path that was navigating to, resets state.
	 */
	complete(): string | null {
		const path = this.pendingPath;
		this.state = "idle";
		this.pendingPath = null;
		this.isPlugin = false;
		return path;
	}

	/**
	 * Check if any navigation is in progress.
	 */
	isNavigating(): boolean {
		return this.state === "navigating";
	}

	/**
	 * Check if current navigation is plugin-initiated.
	 */
	isPluginNav(): boolean {
		return this.isPlugin;
	}

	/**
	 * Get the path being navigated to.
	 */
	getPendingPath(): string | null {
		return this.pendingPath;
	}
}
