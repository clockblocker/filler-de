/**
 * Tests for EventHelpers module.
 * Ensures the event helper functions work correctly.
 */

import { describe, expect, it } from "bun:test";
import {
	EventHelpers,
	asFileCreatedEvent,
	asFileDeletedEvent,
	asFileRenamedEvent,
	asFolderCreatedEvent,
	asFolderDeletedEvent,
	asFolderRenamedEvent,
	eventsSharePath,
	getEventFromSplitPath,
	getEventKey,
	getEventParentPathParts,
	getEventPath,
	getEventPathDepth,
	getEventSplitPath,
	getEventToPath,
	getEventToSplitPath,
	isCreateEvent,
	isDeleteEvent,
	isFileCreatedEvent,
	isFileDeletedEvent,
	isFileEvent,
	isFileRenamedEvent,
	isFileSplitPath,
	isFolderCreatedEvent,
	isFolderDeletedEvent,
	isFolderEvent,
	isFolderRenamedEvent,
	isFolderSplitPath,
	isMdFileSplitPath,
	isRenameEvent,
	visitEvent,
	visitSplitPath,
} from "../../../src/managers/obsidian/vault-action-manager/helpers/event-helpers";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultEvent,
	VaultEventKind,
} from "../../../src/managers/obsidian/vault-action-manager/types/vault-event";

// ─── Test Helpers ───

const folder = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToFolder => ({
	basename,
	kind: "Folder",
	pathParts,
});

const mdFile = (
	basename: string,
	pathParts: string[] = [],
): SplitPathToMdFile => ({
	basename,
	extension: "md",
	kind: "MdFile",
	pathParts,
});

const file = (
	basename: string,
	extension: string,
	pathParts: string[] = [],
): SplitPathToFile => ({
	basename,
	extension,
	kind: "File",
	pathParts,
});

describe("EventHelpers", () => {
	describe("Classification Functions", () => {
		describe("isCreateEvent", () => {
			it("returns true for FileCreated", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				};
				expect(isCreateEvent(event)).toBe(true);
			});

			it("returns true for FolderCreated", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderCreated,
					splitPath: folder("test"),
				};
				expect(isCreateEvent(event)).toBe(true);
			});

			it("returns false for delete events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileDeleted,
					splitPath: mdFile("test"),
				};
				expect(isCreateEvent(event)).toBe(false);
			});
		});

		describe("isDeleteEvent", () => {
			it("returns true for FileDeleted", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileDeleted,
					splitPath: mdFile("test"),
				};
				expect(isDeleteEvent(event)).toBe(true);
			});

			it("returns true for FolderDeleted", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderDeleted,
					splitPath: folder("test"),
				};
				expect(isDeleteEvent(event)).toBe(true);
			});

			it("returns false for create events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				};
				expect(isDeleteEvent(event)).toBe(false);
			});
		});

		describe("isRenameEvent", () => {
			it("returns true for FileRenamed", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from: mdFile("old"),
					to: mdFile("new"),
				};
				expect(isRenameEvent(event)).toBe(true);
			});

			it("returns true for FolderRenamed", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderRenamed,
					from: folder("old"),
					to: folder("new"),
				};
				expect(isRenameEvent(event)).toBe(true);
			});

			it("returns false for create events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				};
				expect(isRenameEvent(event)).toBe(false);
			});
		});

		describe("isFolderEvent", () => {
			it("returns true for folder events", () => {
				expect(
					isFolderEvent({
						kind: VaultEventKind.FolderCreated,
						splitPath: folder("test"),
					}),
				).toBe(true);
				expect(
					isFolderEvent({
						kind: VaultEventKind.FolderDeleted,
						splitPath: folder("test"),
					}),
				).toBe(true);
				expect(
					isFolderEvent({
						kind: VaultEventKind.FolderRenamed,
						from: folder("old"),
						to: folder("new"),
					}),
				).toBe(true);
			});

			it("returns false for file events", () => {
				expect(
					isFolderEvent({
						kind: VaultEventKind.FileCreated,
						splitPath: mdFile("test"),
					}),
				).toBe(false);
			});
		});

		describe("isFileEvent", () => {
			it("returns true for file events", () => {
				expect(
					isFileEvent({
						kind: VaultEventKind.FileCreated,
						splitPath: mdFile("test"),
					}),
				).toBe(true);
				expect(
					isFileEvent({
						kind: VaultEventKind.FileDeleted,
						splitPath: file("img", "png"),
					}),
				).toBe(true);
				expect(
					isFileEvent({
						kind: VaultEventKind.FileRenamed,
						from: mdFile("old"),
						to: mdFile("new"),
					}),
				).toBe(true);
			});

			it("returns false for folder events", () => {
				expect(
					isFileEvent({
						kind: VaultEventKind.FolderCreated,
						splitPath: folder("test"),
					}),
				).toBe(false);
			});
		});
	});

	describe("Individual Type Guards", () => {
		it("isFileCreatedEvent", () => {
			expect(
				isFileCreatedEvent({
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				}),
			).toBe(true);
			expect(
				isFileCreatedEvent({
					kind: VaultEventKind.FileDeleted,
					splitPath: mdFile("test"),
				}),
			).toBe(false);
		});

		it("isFileDeletedEvent", () => {
			expect(
				isFileDeletedEvent({
					kind: VaultEventKind.FileDeleted,
					splitPath: mdFile("test"),
				}),
			).toBe(true);
		});

		it("isFileRenamedEvent", () => {
			expect(
				isFileRenamedEvent({
					kind: VaultEventKind.FileRenamed,
					from: mdFile("old"),
					to: mdFile("new"),
				}),
			).toBe(true);
		});

		it("isFolderCreatedEvent", () => {
			expect(
				isFolderCreatedEvent({
					kind: VaultEventKind.FolderCreated,
					splitPath: folder("test"),
				}),
			).toBe(true);
		});

		it("isFolderDeletedEvent", () => {
			expect(
				isFolderDeletedEvent({
					kind: VaultEventKind.FolderDeleted,
					splitPath: folder("test"),
				}),
			).toBe(true);
		});

		it("isFolderRenamedEvent", () => {
			expect(
				isFolderRenamedEvent({
					kind: VaultEventKind.FolderRenamed,
					from: folder("old"),
					to: folder("new"),
				}),
			).toBe(true);
		});
	});

	describe("Path Extraction", () => {
		describe("getEventSplitPath", () => {
			it("returns splitPath for create events", () => {
				const sp = mdFile("test", ["parent"]);
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: sp,
				};
				expect(getEventSplitPath(event)).toBe(sp);
			});

			it("returns from path for rename events", () => {
				const from = mdFile("old", ["docs"]);
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from,
					to: mdFile("new", ["docs"]),
				};
				expect(getEventSplitPath(event)).toBe(from);
			});
		});

		describe("getEventToSplitPath", () => {
			it("returns to path for rename events", () => {
				const to = mdFile("new", ["docs"]);
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from: mdFile("old", ["docs"]),
					to,
				};
				expect(getEventToSplitPath(event)).toBe(to);
			});

			it("returns undefined for non-rename events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				};
				expect(getEventToSplitPath(event)).toBeUndefined();
			});
		});

		describe("getEventFromSplitPath", () => {
			it("returns from path for rename events", () => {
				const from = mdFile("old", ["docs"]);
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from,
					to: mdFile("new", ["docs"]),
				};
				expect(getEventFromSplitPath(event)).toBe(from);
			});

			it("returns undefined for non-rename events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				};
				expect(getEventFromSplitPath(event)).toBeUndefined();
			});
		});

		describe("getEventPath", () => {
			it("extracts path from FileCreated with md file", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("note", ["docs"]),
				};
				expect(getEventPath(event)).toEqual(["docs", "note.md"]);
			});

			it("extracts path from FolderCreated", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderCreated,
					splitPath: folder("test", ["parent"]),
				};
				expect(getEventPath(event)).toEqual(["parent", "test"]);
			});

			it("extracts from path for FileRenamed", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from: mdFile("old", ["docs"]),
					to: mdFile("new", ["docs"]),
				};
				expect(getEventPath(event)).toEqual(["docs", "old.md"]);
			});

			it("extracts path from FileCreated with regular file", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: file("image", "png", ["assets"]),
				};
				expect(getEventPath(event)).toEqual(["assets", "image.png"]);
			});
		});

		describe("getEventToPath", () => {
			it("returns to path for rename events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from: mdFile("old", ["docs"]),
					to: mdFile("new", ["other"]),
				};
				expect(getEventToPath(event)).toEqual(["other", "new.md"]);
			});

			it("returns undefined for non-rename events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				};
				expect(getEventToPath(event)).toBeUndefined();
			});
		});

		describe("getEventParentPathParts", () => {
			it("returns pathParts from split path", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("note", ["docs", "subdir"]),
				};
				expect(getEventParentPathParts(event)).toEqual(["docs", "subdir"]);
			});
		});

		describe("getEventPathDepth", () => {
			it("counts path segments", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderCreated,
					splitPath: folder("deep", ["a", "b", "c"]),
				};
				expect(getEventPathDepth(event)).toBe(4); // a, b, c, deep
			});
		});
	});

	describe("Event Identification", () => {
		describe("getEventKey", () => {
			it("creates unique key for create events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderCreated,
					splitPath: folder("test", ["parent"]),
				};
				expect(getEventKey(event)).toBe("FolderCreated:parent/test");
			});

			it("creates unique key for rename events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from: mdFile("old", ["docs"]),
					to: mdFile("new", ["other"]),
				};
				expect(getEventKey(event)).toBe(
					"FileRenamed:docs/old.md→other/new.md",
				);
			});
		});

		describe("eventsSharePath", () => {
			it("returns true for same path", () => {
				const a: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test", ["parent"]),
				};
				const b: VaultEvent = {
					kind: VaultEventKind.FileDeleted,
					splitPath: mdFile("test", ["parent"]),
				};
				expect(eventsSharePath(a, b)).toBe(true);
			});

			it("returns false for different paths", () => {
				const a: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test1", ["parent"]),
				};
				const b: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test2", ["parent"]),
				};
				expect(eventsSharePath(a, b)).toBe(false);
			});
		});
	});

	describe("Type Narrowing", () => {
		describe("asFileCreatedEvent", () => {
			it("returns event for FileCreated", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test"),
				};
				expect(asFileCreatedEvent(event)).toBe(event);
			});

			it("returns undefined for other events", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderCreated,
					splitPath: folder("test"),
				};
				expect(asFileCreatedEvent(event)).toBeUndefined();
			});
		});

		describe("asFileDeletedEvent", () => {
			it("returns event for FileDeleted", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileDeleted,
					splitPath: mdFile("test"),
				};
				expect(asFileDeletedEvent(event)).toBe(event);
			});
		});

		describe("asFileRenamedEvent", () => {
			it("returns event for FileRenamed", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileRenamed,
					from: mdFile("old"),
					to: mdFile("new"),
				};
				expect(asFileRenamedEvent(event)).toBe(event);
			});
		});

		describe("asFolderCreatedEvent", () => {
			it("returns event for FolderCreated", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderCreated,
					splitPath: folder("test"),
				};
				expect(asFolderCreatedEvent(event)).toBe(event);
			});
		});

		describe("asFolderDeletedEvent", () => {
			it("returns event for FolderDeleted", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderDeleted,
					splitPath: folder("test"),
				};
				expect(asFolderDeletedEvent(event)).toBe(event);
			});
		});

		describe("asFolderRenamedEvent", () => {
			it("returns event for FolderRenamed", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FolderRenamed,
					from: folder("old"),
					to: folder("new"),
				};
				expect(asFolderRenamedEvent(event)).toBe(event);
			});
		});
	});

	describe("SplitPath Type Helpers", () => {
		it("isFolderSplitPath", () => {
			expect(isFolderSplitPath(folder("test"))).toBe(true);
			expect(isFolderSplitPath(mdFile("test"))).toBe(false);
			expect(isFolderSplitPath(file("img", "png"))).toBe(false);
		});

		it("isFileSplitPath", () => {
			expect(isFileSplitPath(file("img", "png"))).toBe(true);
			expect(isFileSplitPath(folder("test"))).toBe(false);
			expect(isFileSplitPath(mdFile("test"))).toBe(false);
		});

		it("isMdFileSplitPath", () => {
			expect(isMdFileSplitPath(mdFile("test"))).toBe(true);
			expect(isMdFileSplitPath(folder("test"))).toBe(false);
			expect(isMdFileSplitPath(file("img", "png"))).toBe(false);
		});
	});

	describe("Visitor Pattern", () => {
		describe("visitEvent", () => {
			it("calls correct handler for each event type", () => {
				const handler = (kind: string) => `handled ${kind}`;

				const events: VaultEvent[] = [
					{ kind: VaultEventKind.FileCreated, splitPath: mdFile("test") },
					{ kind: VaultEventKind.FileDeleted, splitPath: mdFile("test") },
					{
						kind: VaultEventKind.FileRenamed,
						from: mdFile("old"),
						to: mdFile("new"),
					},
					{ kind: VaultEventKind.FolderCreated, splitPath: folder("test") },
					{ kind: VaultEventKind.FolderDeleted, splitPath: folder("test") },
					{
						kind: VaultEventKind.FolderRenamed,
						from: folder("old"),
						to: folder("new"),
					},
				];

				const results = events.map((e) =>
					visitEvent(e, {
						FileCreated: () => handler("FileCreated"),
						FileDeleted: () => handler("FileDeleted"),
						FileRenamed: () => handler("FileRenamed"),
						FolderCreated: () => handler("FolderCreated"),
						FolderDeleted: () => handler("FolderDeleted"),
						FolderRenamed: () => handler("FolderRenamed"),
					}),
				);

				expect(results).toEqual([
					"handled FileCreated",
					"handled FileDeleted",
					"handled FileRenamed",
					"handled FolderCreated",
					"handled FolderDeleted",
					"handled FolderRenamed",
				]);
			});

			it("passes event to handler", () => {
				const event: VaultEvent = {
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("test", ["docs"]),
				};

				const result = visitEvent(event, {
					FileCreated: (e) => e.splitPath.basename,
					FileDeleted: () => "",
					FileRenamed: () => "",
					FolderCreated: () => "",
					FolderDeleted: () => "",
					FolderRenamed: () => "",
				});

				expect(result).toBe("test");
			});
		});

		describe("visitSplitPath", () => {
			it("calls correct handler for each split path type", () => {
				expect(
					visitSplitPath(folder("test"), {
						Folder: () => "folder",
						File: () => "file",
						MdFile: () => "mdFile",
					}),
				).toBe("folder");

				expect(
					visitSplitPath(file("img", "png"), {
						Folder: () => "folder",
						File: () => "file",
						MdFile: () => "mdFile",
					}),
				).toBe("file");

				expect(
					visitSplitPath(mdFile("note"), {
						Folder: () => "folder",
						File: () => "file",
						MdFile: () => "mdFile",
					}),
				).toBe("mdFile");
			});
		});
	});

	describe("Namespace Export", () => {
		it("exports all functions", () => {
			expect(EventHelpers.isCreateEvent).toBeDefined();
			expect(EventHelpers.isDeleteEvent).toBeDefined();
			expect(EventHelpers.isRenameEvent).toBeDefined();
			expect(EventHelpers.isFolderEvent).toBeDefined();
			expect(EventHelpers.isFileEvent).toBeDefined();
			expect(EventHelpers.isFileCreatedEvent).toBeDefined();
			expect(EventHelpers.isFileDeletedEvent).toBeDefined();
			expect(EventHelpers.isFileRenamedEvent).toBeDefined();
			expect(EventHelpers.isFolderCreatedEvent).toBeDefined();
			expect(EventHelpers.isFolderDeletedEvent).toBeDefined();
			expect(EventHelpers.isFolderRenamedEvent).toBeDefined();
			expect(EventHelpers.getEventSplitPath).toBeDefined();
			expect(EventHelpers.getEventToSplitPath).toBeDefined();
			expect(EventHelpers.getEventFromSplitPath).toBeDefined();
			expect(EventHelpers.getEventPath).toBeDefined();
			expect(EventHelpers.getEventToPath).toBeDefined();
			expect(EventHelpers.getEventParentPathParts).toBeDefined();
			expect(EventHelpers.getEventPathDepth).toBeDefined();
			expect(EventHelpers.getEventKey).toBeDefined();
			expect(EventHelpers.eventsSharePath).toBeDefined();
			expect(EventHelpers.asFileCreatedEvent).toBeDefined();
			expect(EventHelpers.asFileDeletedEvent).toBeDefined();
			expect(EventHelpers.asFileRenamedEvent).toBeDefined();
			expect(EventHelpers.asFolderCreatedEvent).toBeDefined();
			expect(EventHelpers.asFolderDeletedEvent).toBeDefined();
			expect(EventHelpers.asFolderRenamedEvent).toBeDefined();
			expect(EventHelpers.isFolderSplitPath).toBeDefined();
			expect(EventHelpers.isFileSplitPath).toBeDefined();
			expect(EventHelpers.isMdFileSplitPath).toBeDefined();
			expect(EventHelpers.visitEvent).toBeDefined();
			expect(EventHelpers.visitSplitPath).toBeDefined();
		});
	});
});
