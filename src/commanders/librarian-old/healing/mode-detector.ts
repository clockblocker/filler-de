import {
	DragInSubtype,
	HealingMode,
	RuntimeSubtype,
} from "../../librarin-shared/types/literals";

/**
 * Event mode classification for healing.
 */
export type EventMode =
	| { mode: typeof HealingMode.Runtime; subtype: RuntimeSubtype }
	| { mode: typeof HealingMode.Init }
	| { mode: typeof HealingMode.DragIn; subtype: DragInSubtype };

/**
 * Input for rename event detection.
 */
export type RenameEventInput = {
	oldPath: string;
	newPath: string;
	isFolder: boolean;
};

/**
 * Check if a path is inside the library root.
 */
function isInsideLibrary(path: string, libraryRoot: string): boolean {
	return path.startsWith(`${libraryRoot}/`) || path === libraryRoot;
}

/**
 * Extract parent path from full path.
 */
function getParentPath(path: string): string {
	const lastSlash = path.lastIndexOf("/");
	return lastSlash === -1 ? "" : path.slice(0, lastSlash);
}

/**
 * Extract basename from full path.
 */
function getBasename(path: string): string {
	const lastSlash = path.lastIndexOf("/");
	return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

/**
 * Detect the healing mode for a rename event.
 *
 * - DragIn: oldPath outside library, newPath inside
 * - Runtime: both paths inside library, classify by what changed
 */
export function detectRenameMode(
	event: RenameEventInput,
	libraryRoot: string,
): EventMode | null {
	const { oldPath, newPath, isFolder } = event;

	const oldInside = isInsideLibrary(oldPath, libraryRoot);
	const newInside = isInsideLibrary(newPath, libraryRoot);

	// Moved out of library - not our concern
	if (oldInside && !newInside) {
		return null;
	}

	// Drag-in from outside
	if (!oldInside && newInside) {
		return {
			mode: HealingMode.DragIn,
			subtype: isFolder ? DragInSubtype.Folder : DragInSubtype.File,
		};
	}

	// Both inside library - runtime mode
	if (oldInside && newInside) {
		const oldParent = getParentPath(oldPath);
		const newParent = getParentPath(newPath);
		const oldBasename = getBasename(oldPath);
		const newBasename = getBasename(newPath);

		const parentChanged = oldParent !== newParent;
		const basenameChanged = oldBasename !== newBasename;

		if (basenameChanged && !parentChanged) {
			return {
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.BasenameOnly,
			};
		}

		if (parentChanged && !basenameChanged) {
			return {
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.PathOnly,
			};
		}

		if (parentChanged && basenameChanged) {
			return {
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.Both,
			};
		}

		// No change? Shouldn't happen, but return null
		return null;
	}

	// Both outside library - not our concern
	return null;
}

/**
 * Create Init mode event (for startup healing).
 */
export function createInitMode(): EventMode {
	return { mode: HealingMode.Init };
}
