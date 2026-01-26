/**
 * WorkspaceListener - wraps Obsidian workspace event registration.
 */

import type { App, EventRef, TFile } from "obsidian";
import { makeSplitPath } from "../../vault-action-manager";
import {
	type WorkspaceEvent,
	WorkspaceEventKind,
} from "../types/workspace-event";

export type WorkspaceEmitter = (event: WorkspaceEvent) => void;

export interface Listener {
	startListening(emit: WorkspaceEmitter): void;
	stopListening(): void;
}

export class WorkspaceListener implements Listener {
	private emit: WorkspaceEmitter | null = null;
	private layoutChangeRef: EventRef | null = null;
	private fileOpenRef: EventRef | null = null;
	private resizeRef: EventRef | null = null;
	private scrollHandler: (() => void) | null = null;

	constructor(private readonly app: App) {}

	startListening(emit: WorkspaceEmitter): void {
		if (this.emit) return;

		this.emit = emit;
		const { workspace } = this.app;

		workspace.onLayoutReady(() => {
			this.emit?.({ kind: WorkspaceEventKind.LayoutReady });
		});

		this.layoutChangeRef = workspace.on("layout-change", () => {
			this.emit?.({ kind: WorkspaceEventKind.LayoutChange });
		});

		this.fileOpenRef = workspace.on("file-open", (file: TFile | null) => {
			this.emit?.({
				file: file ? makeSplitPath(file) : null,
				kind: WorkspaceEventKind.FileOpen,
			});
		});

		this.resizeRef = workspace.on("resize", () => {
			this.emit?.({ kind: WorkspaceEventKind.Resize });
		});

		// Listen for scroll events (capture phase to catch all scrolls)
		this.scrollHandler = () => {
			this.emit?.({ kind: WorkspaceEventKind.Scroll });
		};
		window.addEventListener("scroll", this.scrollHandler, true);
	}

	stopListening(): void {
		if (!this.emit) return;

		const { workspace } = this.app;

		if (this.layoutChangeRef) {
			workspace.offref(this.layoutChangeRef);
			this.layoutChangeRef = null;
		}

		if (this.fileOpenRef) {
			workspace.offref(this.fileOpenRef);
			this.fileOpenRef = null;
		}

		if (this.resizeRef) {
			workspace.offref(this.resizeRef);
			this.resizeRef = null;
		}

		if (this.scrollHandler) {
			window.removeEventListener("scroll", this.scrollHandler, true);
			this.scrollHandler = null;
		}

		this.emit = null;
	}
}
