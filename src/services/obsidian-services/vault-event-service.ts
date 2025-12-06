import type { App, TAbstractFile } from "obsidian";
import type { Librarian } from "../../commanders/librarian/librarian";
import { fullPathFromSystemPath } from "./atomic-services/pathfinder";

/**
 * Listens to vault events and delegates to appropriate handlers.
 * Centralizes all vault event subscriptions in one place.
 */
export class VaultEventService {
	private unsubscribers: (() => void)[] = [];

	constructor(
		private app: App,
		private librarian: Librarian,
	) {}

	/**
	 * Start listening to vault events.
	 * Call this after Librarian trees are initialized.
	 */
	start(): void {
		// Delete event
		const deleteRef = this.app.vault.on("delete", (file) => {
			this.handleDelete(file);
		});

		// Rename event (also fires for moves)
		const renameRef = this.app.vault.on("rename", (file, oldPath) => {
			this.handleRename(file, oldPath);
		});

		// Create event
		const createRef = this.app.vault.on("create", (file) => {
			this.handleCreate(file);
		});

		console.log("[VaultEventService] Started listening to vault events");
	}

	/**
	 * Stop listening to all vault events.
	 */
	stop(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		console.log("[VaultEventService] Stopped listening to vault events");
	}

	private handleDelete(file: TAbstractFile): void {
		// Only handle files in library folders
		if (!this.isInLibraryFolder(file.path)) {
			return;
		}

		console.log("[VaultEventService] Delete:", file.path);
		this.librarian.onFileDeleted(file);
	}

	private handleRename(file: TAbstractFile, oldPath: string): void {
		const wasInLibrary = this.isInLibraryFolder(oldPath);
		const isInLibrary = this.isInLibraryFolder(file.path);

		// Ignore if neither old nor new path is in library
		if (!wasInLibrary && !isInLibrary) {
			return;
		}

		console.log("[VaultEventService] Rename:", oldPath, "→", file.path);
		this.librarian.onFileRenamed(file, oldPath);
	}

	private handleCreate(file: TAbstractFile): void {
		// Only handle files in library folders
		if (!this.isInLibraryFolder(file.path)) {
			return;
		}

		console.log("[VaultEventService] Create:", file.path);
		this.librarian.onFileCreated(file);
	}

	private isInLibraryFolder(path: string): boolean {
		const fullPath = fullPathFromSystemPath(path);
		const rootName = fullPath.pathParts[0];
		// TODO: Use shared ROOTS constant
		return rootName === "Library";
	}
}
