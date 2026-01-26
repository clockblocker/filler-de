/**
 * OverlayManager - manages UI overlays like the bottom toolbar.
 *
 * Subscribes to workspace events and maintains a toolbar on EVERY open markdown pane.
 * Toolbars persist when switching between panes and are only destroyed when their
 * leaf closes. Each toolbar tracks its own file path context.
 */

import type { App } from "obsidian";
import type { SplitPathToMdFile } from "../obsidian/vault-action-manager/types/split-path";
import type {
	Teardown,
	WorkspaceEvent,
} from "../obsidian/workspace-navigation-event-interceptor";
import {
	WorkspaceEventInterceptor,
	WorkspaceEventKind,
} from "../obsidian/workspace-navigation-event-interceptor";
import { type BottomToolbar, createBottomToolbar } from "./bottom-toolbar";

/**
 * Dependencies for OverlayManager.
 */
export type OverlayManagerDeps = {
	/** Obsidian app instance */
	app: App;
};

/**
 * OverlayManager - orchestrates UI overlays based on workspace events.
 */
export class OverlayManager {
	private readonly app: App;
	private readonly workspaceInterceptor: WorkspaceEventInterceptor;
	private workspaceTeardown: Teardown | null = null;
	/** Toolbars per leaf, keyed by leaf ID */
	private toolbars = new Map<string, BottomToolbar>();

	constructor(deps: OverlayManagerDeps) {
		this.app = deps.app;
		this.workspaceInterceptor = new WorkspaceEventInterceptor(this.app);
	}

	/**
	 * Initialize and start listening to workspace events.
	 */
	init(): void {
		this.workspaceInterceptor.startListening();
		this.workspaceTeardown = this.workspaceInterceptor.subscribe(
			this.handleWorkspaceEvent.bind(this),
		);

		// Check current state on init
		this.updateToolbarVisibility();
	}

	/**
	 * Get the current file path from the active leaf's toolbar.
	 */
	getCurrentFilePath(): SplitPathToMdFile | null {
		const activeLeaf = this.app.workspace.activeLeaf;
		// Obsidian leaf.id is not in public API, accessing via any
		const leafId = (activeLeaf as any)?.id as string | undefined;
		if (!leafId) return null;
		return this.toolbars.get(leafId)?.getCurrentFilePath() ?? null;
	}

	/**
	 * Clean up and stop listening.
	 */
	destroy(): void {
		if (this.workspaceTeardown) {
			this.workspaceTeardown();
			this.workspaceTeardown = null;
		}

		this.workspaceInterceptor.stopListening();

		for (const toolbar of this.toolbars.values()) {
			toolbar.destroy();
		}
		this.toolbars.clear();
	}

	// ─── Private ───

	private handleWorkspaceEvent(event: WorkspaceEvent): void {
		switch (event.kind) {
			case WorkspaceEventKind.FileOpen:
			case WorkspaceEventKind.LayoutChange:
				this.updateToolbarVisibility();
				break;
			case WorkspaceEventKind.LayoutReady:
			case WorkspaceEventKind.Resize:
				// No action needed
				break;
		}
	}

	private updateToolbarVisibility(): void {
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		const activeLeafIds = new Set<string>();

		for (const leaf of leaves) {
			const file = leaf.view?.file;
			if (!file || file.extension !== "md") continue;

			// Obsidian leaf.id is not in public API, accessing via any
			const leafId = (leaf as any).id as string | undefined;
			if (!leafId) continue;
			activeLeafIds.add(leafId);

			const container = leaf.view.containerEl?.querySelector(".view-content");
			if (!container || !(container instanceof HTMLElement)) continue;

			// Create toolbar if not exists for this leaf
			if (!this.toolbars.has(leafId)) {
				const toolbar = createBottomToolbar({ container });
				this.toolbars.set(leafId, toolbar);
			}

			const filePath = this.buildSplitPath(file.path);
			if (filePath) {
				this.toolbars.get(leafId)!.show(filePath);
			}
		}

		// Remove toolbars for closed leaves
		for (const [leafId, toolbar] of this.toolbars) {
			if (!activeLeafIds.has(leafId)) {
				toolbar.destroy();
				this.toolbars.delete(leafId);
			}
		}
	}

	private buildSplitPath(path: string): SplitPathToMdFile | null {
		// Split path into segments
		const parts = path.split("/");
		const basename = parts.pop();

		if (!basename || !basename.endsWith(".md")) {
			return null;
		}

		// Remove .md extension for basename
		const basenameWithoutExt = basename.slice(0, -3);

		return {
			basename: basenameWithoutExt,
			extension: "md",
			segments: parts,
		};
	}
}
