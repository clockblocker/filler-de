/**
 * WorkspaceEventInterceptor - unified facade for Obsidian workspace events.
 *
 * Wraps:
 * - layout-ready: fires once when Obsidian is fully ready
 * - layout-change: panes opened/closed/moved
 * - active-leaf-change: user switches tabs/panes
 * - resize: workspace resized
 *
 * Provides single subscription point for all workspace events.
 */

import type { App } from "obsidian";
import { logger } from "../../../utils/logger";
import { WorkspaceListener } from "./listeners/workspace-listener";
import type {
	Teardown,
	WorkspaceEvent,
	WorkspaceEventHandler,
} from "./types/workspace-event";

export class WorkspaceEventInterceptor {
	private readonly subscribers = new Set<WorkspaceEventHandler>();
	private readonly listener: WorkspaceListener;
	private listening = false;

	constructor(app: App) {
		this.listener = new WorkspaceListener(app);
	}

	subscribe(handler: WorkspaceEventHandler): Teardown {
		this.subscribers.add(handler);
		return () => this.subscribers.delete(handler);
	}

	startListening(): void {
		if (this.listening) return;

		this.listening = true;
		this.listener.startListening((event) => this.emit(event));
	}

	stopListening(): void {
		if (!this.listening) return;

		this.listening = false;
		this.listener.stopListening();
	}

	private emit(event: WorkspaceEvent): void {
		for (const handler of this.subscribers) {
			try {
				handler(event);
			} catch (error) {
				logger.error(
					"[WorkspaceEventInterceptor] Handler error:",
					error,
				);
			}
		}
	}
}
