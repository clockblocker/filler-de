import type { LibraryTree } from "./library-tree/library-tree";

/**
 * Small holder for mutable Librarian state.
 */
export class LibrarianState {
	tree: LibraryTree | null = null;
	skipReconciliation = false;
}
