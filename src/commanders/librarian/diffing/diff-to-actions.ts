import {
	type BackgroundVaultAction,
	BackgroundVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import type { TextDto, TreePath } from "../types";
import type { StatusChange, TreeDiff } from "./types";

/**
 * Maps tree diffs to vault actions.
 *
 * Note: Codex content generation is NOT handled here.
 * This mapper produces structural actions only.
 * Codex-specific logic should be added via composition or extension.
 */
export class DiffToActionsMapper {
	private rootName: string;

	constructor(rootName: string) {
		this.rootName = rootName;
	}

	/**
	 * Convert a tree diff into vault actions.
	 */
	mapDiffToActions(diff: TreeDiff): BackgroundVaultAction[] {
		const actions: BackgroundVaultAction[] = [];

		// Handle added sections (create folders)
		for (const sectionPath of diff.addedSections) {
			actions.push(this.createFolderAction(sectionPath));
		}

		// Handle added texts (create files)
		for (const text of diff.addedTexts) {
			actions.push(...this.createTextActions(text));
		}

		// Handle removed texts (trash files)
		for (const text of diff.removedTexts) {
			actions.push(...this.trashTextActions(text));
		}

		// Handle removed sections (trash folders) - in reverse order (deepest first)
		const sortedRemovedSections = [...diff.removedSections].sort(
			(a, b) => b.length - a.length,
		);
		for (const sectionPath of sortedRemovedSections) {
			actions.push(this.trashFolderAction(sectionPath));
		}

		// Handle status changes
		// Status changes affect Codex files, but we don't generate content here
		// Just collect the affected paths for downstream processing
		const affectedCodexPaths = this.getAffectedCodexPaths(
			diff.statusChanges,
		);
		for (const codexPath of affectedCodexPaths) {
			// Placeholder: actual Codex content generation happens elsewhere
			// This just marks that these Codex files need updating
			actions.push(this.updateCodexPlaceholder(codexPath));
		}

		return actions;
	}

	/**
	 * Get all Codex paths affected by status changes.
	 * Includes all ancestors up to (but not including) root.
	 */
	getAffectedCodexPaths(statusChanges: StatusChange[]): Set<string> {
		const paths = new Set<string>();

		for (const change of statusChanges) {
			// Walk up the path, adding each ancestor
			// A status change at ['A', 'B', 'C', '000'] affects:
			// - ['A', 'B', 'C'] (the text/book)
			// - ['A', 'B'] (parent section)
			// - ['A'] (grandparent section)
			let current = change.path.slice(0, -1); // Remove page name
			while (current.length > 0) {
				paths.add(current.join("/"));
				current = current.slice(0, -1);
			}
		}

		return paths;
	}

	private createFolderAction(sectionPath: TreePath): BackgroundVaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: BackgroundVaultActionType.CreateFolder,
		};
	}

	private trashFolderAction(sectionPath: TreePath): BackgroundVaultAction {
		return {
			payload: {
				prettyPath: this.sectionPathToPrettyPath(sectionPath),
			},
			type: BackgroundVaultActionType.TrashFolder,
		};
	}

	private createTextActions(text: TextDto): BackgroundVaultAction[] {
		const actions: BackgroundVaultAction[] = [];
		const pageNames = Object.keys(text.pageStatuses);

		if (pageNames.length === 1) {
			// Scroll (single page = single file)
			const pageName = pageNames[0];
			if (pageName) {
				actions.push({
					payload: {
						content: "", // Content will be set by Codex generator or user
						prettyPath: this.scrollPathToPrettyPath(text.path),
					},
					type: BackgroundVaultActionType.CreateFile,
				});
			}
		} else {
			// Book (multiple pages)
			// Create folder for the book
			actions.push({
				payload: {
					prettyPath: this.bookFolderToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.CreateFolder,
			});

			// Create page files
			for (const pageName of pageNames) {
				actions.push({
					payload: {
						content: "", // Content will be set by user
						prettyPath: this.pagePathToPrettyPath(
							text.path,
							pageName,
						),
					},
					type: BackgroundVaultActionType.CreateFile,
				});
			}

			// Create Codex file for the book
			actions.push({
				payload: {
					content: "", // Content will be set by Codex generator
					prettyPath: this.bookCodexToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.CreateFile,
			});
		}

		return actions;
	}

	private trashTextActions(text: TextDto): BackgroundVaultAction[] {
		const actions: BackgroundVaultAction[] = [];
		const pageNames = Object.keys(text.pageStatuses);

		if (pageNames.length === 1) {
			// Scroll
			actions.push({
				payload: {
					prettyPath: this.scrollPathToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.TrashFile,
			});
		} else {
			// Book - trash pages first, then folder
			for (const pageName of pageNames) {
				actions.push({
					payload: {
						prettyPath: this.pagePathToPrettyPath(
							text.path,
							pageName,
						),
					},
					type: BackgroundVaultActionType.TrashFile,
				});
			}

			// Trash Codex file
			actions.push({
				payload: {
					prettyPath: this.bookCodexToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.TrashFile,
			});

			// Trash book folder
			actions.push({
				payload: {
					prettyPath: this.bookFolderToPrettyPath(text.path),
				},
				type: BackgroundVaultActionType.TrashFolder,
			});
		}

		return actions;
	}

	/**
	 * Placeholder action for Codex updates.
	 * Actual content generation happens in Codex module.
	 */
	private updateCodexPlaceholder(
		codexPathKey: string,
	): BackgroundVaultAction {
		const pathParts = codexPathKey.split("/");
		const basename = pathParts.pop() ?? "";

		return {
			payload: {
				prettyPath: {
					basename: `__${basename}`,
					pathParts: [this.rootName, ...pathParts],
				},
				transform: (content) => {
					// Placeholder: actual transform will be injected
					// This just marks the file as needing update
					return content;
				},
			},
			type: BackgroundVaultActionType.ProcessFile,
		};
	}

	// Path conversion helpers

	private sectionPathToPrettyPath(sectionPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...sectionPath.slice(0, -1)];
		const basename = sectionPath[sectionPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private scrollPathToPrettyPath(textPath: TreePath): PrettyPath {
		// Scroll filename: Name-Parent-Grandparent.md (reversed path)
		const pathParts = [this.rootName, ...textPath.slice(0, -1)];
		const basename = textPath.toReversed().join("-");
		return { basename, pathParts };
	}

	private bookFolderToPrettyPath(textPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...textPath.slice(0, -1)];
		const basename = textPath[textPath.length - 1] ?? "";
		return { basename, pathParts };
	}

	private bookCodexToPrettyPath(textPath: TreePath): PrettyPath {
		const pathParts = [this.rootName, ...textPath];
		const basename = `__${textPath.toReversed().join("-")}`;
		return { basename, pathParts };
	}

	private pagePathToPrettyPath(
		textPath: TreePath,
		pageName: string,
	): PrettyPath {
		const pathParts = [this.rootName, ...textPath, "Pages"];
		// Page filename: 000-TextName-Parent.md
		const basename = `${pageName}-${textPath.toReversed().join("-")}`;
		return { basename, pathParts };
	}
}
