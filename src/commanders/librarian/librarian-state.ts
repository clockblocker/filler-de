import type { RootName } from "./constants";
import type { LibraryTree } from "./library-tree/library-tree";

/**
 * Small holder for mutable Librarian state.
 */
export class LibrarianState {
	trees: Record<RootName, LibraryTree> = {};
	skipReconciliation = false;
}
