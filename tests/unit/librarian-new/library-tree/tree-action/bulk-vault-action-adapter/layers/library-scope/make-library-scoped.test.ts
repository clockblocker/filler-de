import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeEventLibraryScoped } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/events/make-event-libray-scoped";
import { Scope } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import * as globalState from "../../../../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../../../../src/global-state/parsed-settings";
import { MD } from "../../../../../../../../src/obsidian-vault-action-manager/types/literals";
import { SplitPathType } from "../../../../../../../../src/obsidian-vault-action-manager/types/split-path";
import type { VaultEvent } from "../../../../../../../../src/obsidian-vault-action-manager/types/vault-event";
import { VaultEventType } from "../../../../../../../../src/obsidian-vault-action-manager/types/vault-event";

const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("makeEventLibraryScoped", () => {
	describe("FileCreated", () => {
		it("returns Inside when file is inside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library"]);
			expect(result.splitPath.basename).toBe("Note");
		});

		it("throws when file is outside library", () => {
			const event = {
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});

		it("handles nested library path", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				splitPathToLibraryRoot: {
					basename: "Library",
					pathParts: ["Root"],
					type: SplitPathType.Folder,
				},
			});

			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Root", "Library", "Section"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library", "Section"]);
		});
	});

	describe("FileRenamed", () => {
		it("returns Inside when both paths are inside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: MD,
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Library", "Section"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.from.pathParts).toEqual(["Library"]);
			expect(result.to.pathParts).toEqual(["Library", "Section"]);
		});

		it("returns InsideToOutside when from is inside, to is outside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: MD,
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.InsideToOutside);
			expect(result.from.pathParts).toEqual(["Library"]);
			expect(result.to.pathParts).toEqual(["Other"]);
		});

		it("returns OutsideToInside when from is outside, to is inside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: MD,
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.OutsideToInside);
			expect(result.from.pathParts).toEqual(["Other"]);
			expect(result.to.pathParts).toEqual(["Library"]);
		});

		it("returns Outside when both paths are outside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: MD,
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Another"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.from).toEqual(event.from);
			expect(result.to).toEqual(event.to);
		});
	});

	describe("FileDeleted", () => {
		it("returns InsideToInside when file is inside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Library", "Section"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileDeleted,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library", "Section"]);
		});

		it("returns Outside when file is outside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileDeleted,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});
	});

	describe("FolderCreated", () => {
		it("returns InsideToInside when folder is inside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Section",
					pathParts: ["Library"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library"]);
		});

		it("returns Outside when folder is outside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Section",
					pathParts: ["Other"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});
	});

	describe("FolderRenamed", () => {
		it("returns Inside when both paths are inside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					pathParts: ["Library"],
					type: SplitPathType.Folder,
				},
				to: {
					basename: "New",
					pathParts: ["Library"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.from.pathParts).toEqual(["Library"]);
			expect(result.to.pathParts).toEqual(["Library"]);
		});

		it("returns InsideToOutside when from is inside, to is outside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					pathParts: ["Library"],
					type: SplitPathType.Folder,
				},
				to: {
					basename: "New",
					pathParts: ["Other"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.InsideToOutside);
			expect(result.from.pathParts).toEqual(["Library"]);
		});

		it("returns OutsideToInside when from is outside, to is inside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					pathParts: ["Other"],
					type: SplitPathType.Folder,
				},
				to: {
					basename: "New",
					pathParts: ["Library"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.OutsideToInside);
			expect(result.to.pathParts).toEqual(["Library"]);
		});

		it("returns Outside when both paths are outside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					pathParts: ["Other"],
					type: SplitPathType.Folder,
				},
				to: {
					basename: "New",
					pathParts: ["Another"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderRenamed,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.from).toEqual(event.from);
			expect(result.to).toEqual(event.to);
		});
	});

	describe("FolderDeleted", () => {
		it("returns InsideToInside when folder is inside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Section",
					pathParts: ["Library"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderDeleted,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library"]);
		});

		it("returns Outside when folder is outside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Section",
					pathParts: ["Other"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderDeleted,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});
	});

	describe("edge cases", () => {
		it("returns Outside when path shorter than library root", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: [],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});

		it("returns Outside when path that starts with library root but is not inside", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				splitPathToLibraryRoot: {
					basename: "Library",
					pathParts: [],
					type: SplitPathType.Folder,
				},
			});

			const event: VaultEvent = {
				splitPath: {
					basename: "LibraryNote",
					extension: MD,
					pathParts: [],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});
	});
});

