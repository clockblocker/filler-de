import type { LibraryTreeLegacy } from "./library-tree/library-tree";

/**
 * Small holder for mutable LibrarianLegacy state.
 */
export class LibrarianLegacyStateLegacy {
	tree: LibraryTreeLegacy | null = null;
	skipReconciliation = false;
}
