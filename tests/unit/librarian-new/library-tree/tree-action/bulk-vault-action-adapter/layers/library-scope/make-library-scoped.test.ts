import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeLibraryScopedVaultEvent } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/make-library-scoped-vault-event";
import { Scope } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import * as globalState from "../../../../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../../../../src/global-state/parsed-settings";
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

describe("makeLibraryScopedVaultEvent", () => {
	describe("FileCreated", () => {
		it("returns InsideToInside when file is inside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToInside);
			expect(result.event.splitPath.pathParts).toEqual([]);
			expect(result.event.splitPath.basename).toBe("Note");
		});

		it("returns OutsideToOutside when file is outside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: "md",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
			expect(result.event).toEqual(event);
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
					extension: "md",
					pathParts: ["Root", "Library", "Section"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToInside);
			expect(result.event.splitPath.pathParts).toEqual(["Section"]);
		});
	});

	describe("FileRenamed", () => {
		it("returns InsideToInside when both paths are inside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: "md",
					pathParts: ["Library", "Section"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToInside);
			expect(result.event.from.pathParts).toEqual([]);
			expect(result.event.to.pathParts).toEqual(["Section"]);
		});

		it("returns InsideToOutside when from is inside, to is outside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: "md",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToOutside);
			expect(result.event.from.pathParts).toEqual([]);
			expect(result.event.to.pathParts).toEqual(["Other"]);
		});

		it("returns OutsideToInside when from is outside, to is inside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToInside);
			expect(result.event.from.pathParts).toEqual(["Other"]);
			expect(result.event.to.pathParts).toEqual([]);
		});

		it("returns OutsideToOutside when both paths are outside", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				to: {
					basename: "New",
					extension: "md",
					pathParts: ["Another"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileRenamed,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
			expect(result.event).toEqual(event);
		});
	});

	describe("FileDeleted", () => {
		it("returns InsideToInside when file is inside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library", "Section"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileDeleted,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToInside);
			expect(result.event.splitPath.pathParts).toEqual(["Section"]);
		});

		it("returns OutsideToOutside when file is outside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: "md",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileDeleted,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
			expect(result.event).toEqual(event);
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

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToInside);
			expect(result.event.splitPath.pathParts).toEqual([]);
		});

		it("returns OutsideToOutside when folder is outside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Section",
					pathParts: ["Other"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderCreated,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
			expect(result.event).toEqual(event);
		});
	});

	describe("FolderRenamed", () => {
		it("returns InsideToInside when both paths are inside", () => {
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

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToInside);
			expect(result.event.from.pathParts).toEqual([]);
			expect(result.event.to.pathParts).toEqual([]);
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

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToOutside);
			expect(result.event.from.pathParts).toEqual([]);
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

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToInside);
			expect(result.event.to.pathParts).toEqual([]);
		});

		it("returns OutsideToOutside when both paths are outside", () => {
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

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
			expect(result.event).toEqual(event);
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

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.InsideToInside);
			expect(result.event.splitPath.pathParts).toEqual([]);
		});

		it("returns OutsideToOutside when folder is outside library", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Section",
					pathParts: ["Other"],
					type: SplitPathType.Folder,
				},
				type: VaultEventType.FolderDeleted,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
			expect(result.event).toEqual(event);
		});
	});

	describe("edge cases", () => {
		it("handles path shorter than library root", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: "md",
					pathParts: [],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
		});

		it("handles path that starts with library root but is not inside", () => {
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
					extension: "md",
					pathParts: [],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const result = makeLibraryScopedVaultEvent(event);

			expect(result.scope).toBe(Scope.OutsideToOutside);
		});
	});
});

