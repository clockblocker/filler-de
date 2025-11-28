import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Librarian } from "../../../src/commanders/librarian/librarian";
import { LibraryTree } from "../../../src/commanders/librarian/library-tree/library-tree";
import type { TextDto, TreePath } from "../../../src/commanders/librarian/types";
import { VaultActionType } from "../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionQueue } from "../../../src/services/obsidian-services/file-services/background/vault-action-queue";
import { TextStatus } from "../../../src/types/common-interface/enums";

/**
 * Integration tests for Librarian's withDiff mechanism.
 * Verifies that tree mutations generate correct actions and queue them.
 */
describe("Librarian withDiff integration", () => {
	let mockQueue: {
		push: ReturnType<typeof mock>;
		pushMany: ReturnType<typeof mock>;
		flushNow: ReturnType<typeof mock>;
		clear: ReturnType<typeof mock>;
	};
	let mockBackgroundFileService: {
		getReadersToAllMdFilesInFolder: ReturnType<typeof mock>;
		create: ReturnType<typeof mock>;
	};
	let mockOpenedFileService: {
		pwd: ReturnType<typeof mock>;
		getLastOpenedFile: ReturnType<typeof mock>;
		getApp: ReturnType<typeof mock>;
		cd: ReturnType<typeof mock>;
	};
	let mockApp: {
		vault: { on: ReturnType<typeof mock> };
	};

	beforeEach(() => {
		mockQueue = {
			clear: mock(() => {}),
			flushNow: mock(() => Promise.resolve()),
			push: mock(() => {}),
			pushMany: mock(() => {}),
		};

		mockBackgroundFileService = {
			create: mock(() => Promise.resolve()),
			getReadersToAllMdFilesInFolder: mock(() => Promise.resolve([])),
		};

		mockOpenedFileService = {
			cd: mock(() => Promise.resolve()),
			getApp: mock(() => ({ vault: { getAbstractFileByPath: () => null } })),
			getLastOpenedFile: mock(() => null),
			pwd: mock(() =>
				Promise.resolve({ basename: "test", pathParts: ["Library"] }),
			),
		};

		mockApp = {
			vault: { on: mock(() => {}) },
		};
	});

	describe("setStatus", () => {
		it("should queue actions when status changes", async () => {
			// Create librarian with mock queue
			const librarian = new Librarian({
				actionQueue: mockQueue as unknown as VaultActionQueue,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				app: mockApp as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				backgroundFileService: mockBackgroundFileService as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				openedFileService: mockOpenedFileService as any,
			});

			// Skip reconciliation for testing (tree is set up manually)
			librarian._setSkipReconciliation(true);

			// Manually set up a tree with a text
			const textDto: TextDto = {
				pageStatuses: { "000": TextStatus.NotStarted },
				path: ["Section", "MyText"] as TreePath,
			};
			librarian.trees = {
				Library: new LibraryTree([textDto], "Library"),
			};

			// Change status
			await librarian.setStatus("Library", ["Section", "MyText", "000"], "Done");

			// Verify actions were queued
			expect(mockQueue.pushMany).toHaveBeenCalled();
			const calls = mockQueue.pushMany.mock.calls;
			expect(calls.length).toBe(1);

			const actions = calls[0]?.[0];
			expect(Array.isArray(actions)).toBe(true);
			// Status change should generate UpdateOrCreateFile actions for affected Codex files
			const hasCreateAction = actions.some(
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				(a: any) => a.type === VaultActionType.UpdateOrCreateFile,
			);
			expect(hasCreateAction).toBe(true);
		});

		it("should not queue actions when status unchanged", async () => {
			const librarian = new Librarian({
				actionQueue: mockQueue as unknown as VaultActionQueue,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				app: mockApp as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				backgroundFileService: mockBackgroundFileService as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				openedFileService: mockOpenedFileService as any,
			});

			// Skip reconciliation for testing
			librarian._setSkipReconciliation(true);

			const textDto: TextDto = {
				pageStatuses: { "000": TextStatus.Done },
				path: ["Section", "MyText"] as TreePath,
			};
			librarian.trees = {
				Library: new LibraryTree([textDto], "Library"),
			};

			// Set status to same value
			await librarian.setStatus("Library", ["Section", "MyText", "000"], "Done");

			// pushMany should not be called when actions array is empty
			expect(mockQueue.pushMany).not.toHaveBeenCalled();
		});
	});

	describe("addTexts", () => {
		it("should queue UpdateOrCreateFile actions for new texts", async () => {
			const librarian = new Librarian({
				actionQueue: mockQueue as unknown as VaultActionQueue,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				app: mockApp as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				backgroundFileService: mockBackgroundFileService as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				openedFileService: mockOpenedFileService as any,
			});

			// Skip reconciliation for testing
			librarian._setSkipReconciliation(true);

			// Start with empty tree
			librarian.trees = {
				Library: new LibraryTree([], "Library"),
			};

			// Add a new text
			const newText: TextDto = {
				pageStatuses: { "000": TextStatus.NotStarted },
				path: ["NewSection", "NewText"] as TreePath,
			};
			await librarian.addTexts("Library", [newText]);

			expect(mockQueue.pushMany).toHaveBeenCalled();
			const actions = mockQueue.pushMany.mock.calls[0]?.[0];

			// Should have UpdateOrCreateFolder for section and UpdateOrCreateFile for scroll
			const hasUpdateOrCreateFolder = actions.some(
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				(a: any) => a.type === VaultActionType.UpdateOrCreateFolder,
			);
			const hasUpdateOrCreateFile = actions.some(
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				(a: any) => a.type === VaultActionType.UpdateOrCreateFile,
			);
			expect(hasUpdateOrCreateFolder).toBe(true);
			expect(hasUpdateOrCreateFile).toBe(true);
		});
	});

	describe("deleteTexts", () => {
		it("should queue TrashFile actions for removed texts", async () => {
			const librarian = new Librarian({
				actionQueue: mockQueue as unknown as VaultActionQueue,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				app: mockApp as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				backgroundFileService: mockBackgroundFileService as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				openedFileService: mockOpenedFileService as any,
			});

			// Skip reconciliation for testing
			librarian._setSkipReconciliation(true);

			const textDto: TextDto = {
				pageStatuses: { "000": TextStatus.Done },
				path: ["Section", "TextToDelete"] as TreePath,
			};
			librarian.trees = {
				Library: new LibraryTree([textDto], "Library"),
			};

			// Delete the text
			await librarian.deleteTexts("Library", [["Section", "TextToDelete"]]);

			expect(mockQueue.pushMany).toHaveBeenCalled();
			const actions = mockQueue.pushMany.mock.calls[0]?.[0];

			// Should have TrashFile for the scroll
			const hasTrashFile = actions.some(
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				(a: any) => a.type === VaultActionType.TrashFile,
			);
			expect(hasTrashFile).toBe(true);
		});
	});

	describe("getSnapshot", () => {
		it("should return current tree snapshot", () => {
			const librarian = new Librarian({
				actionQueue: mockQueue as unknown as VaultActionQueue,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				app: mockApp as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				backgroundFileService: mockBackgroundFileService as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				openedFileService: mockOpenedFileService as any,
			});

			const textDto: TextDto = {
				pageStatuses: { "000": TextStatus.Done },
				path: ["Section", "MyText"] as TreePath,
			};
			librarian.trees = {
				Library: new LibraryTree([textDto], "Library"),
			};

			const snapshot = librarian.getSnapshot("Library");
			expect(snapshot).not.toBeNull();
			expect(snapshot?.texts.length).toBe(1);
			expect(snapshot?.sectionPaths.length).toBe(1);
		});

		it("should return null for non-existent tree", () => {
			const librarian = new Librarian({
				actionQueue: mockQueue as unknown as VaultActionQueue,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				app: mockApp as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				backgroundFileService: mockBackgroundFileService as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				openedFileService: mockOpenedFileService as any,
			});
			librarian.trees = {};

			const snapshot = librarian.getSnapshot("Library");
			expect(snapshot).toBeNull();
		});
	});

	describe("queue optional", () => {
		it("should work without queue (no actions queued)", async () => {
			const librarian = new Librarian({
				// No actionQueue provided
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				app: mockApp as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				backgroundFileService: mockBackgroundFileService as any,
				// biome-ignore lint/suspicious/noExplicitAny: test mock
				openedFileService: mockOpenedFileService as any,
			});

			// Skip reconciliation for testing
			librarian._setSkipReconciliation(true);

			const textDto: TextDto = {
				pageStatuses: { "000": TextStatus.NotStarted },
				path: ["Section", "MyText"] as TreePath,
			};
			librarian.trees = {
				Library: new LibraryTree([textDto], "Library"),
			};

			// Should not throw
			await expect(
				librarian.setStatus("Library", ["Section", "MyText", "000"], "Done"),
			).resolves.toBeUndefined();
		});
	});
});

