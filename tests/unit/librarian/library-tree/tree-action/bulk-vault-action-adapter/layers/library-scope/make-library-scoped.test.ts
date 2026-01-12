import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeEventLibraryScoped } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/events/make-event-libray-scoped";
import { Scope } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import { MD } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultEvent } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { defaultSettingsForUnitTests } from "../../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("makeEventLibraryScoped", () => {
	describe("FileCreated", () => {
		it("returns Inside when file is inside library", () => {
			const event: VaultEvent = {
				kind: VaultEventKind.FileCreated,
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Library"],
					type: SplitPathKind.MdFile,
				},
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
					type: SplitPathKind.MdFile,
				},
				type: VaultEventKind.FileCreated,
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});

		it("handles nested library path", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettingsForUnitTests,
				splitPathToLibraryRoot: {
					basename: "Library",
					pathParts: ["Root"],
					type: SplitPathKind.Folder,
				},
			});

			const event: VaultEvent = {
				kind: VaultEventKind.FileCreated,
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Root", "Library", "Section"],
					type: SplitPathKind.MdFile,
				},
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
					type: SplitPathKind.MdFile,
				},
				kind: VaultEventKind.FileRenamed,
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Library", "Section"],
					type: SplitPathKind.MdFile,
				},
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
					type: SplitPathKind.MdFile,
				},
				kind: VaultEventKind.FileRenamed,
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Other"],
					type: SplitPathKind.MdFile,
				},
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
					type: SplitPathKind.MdFile,
				},
				kind: VaultEventKind.FileRenamed,
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Library"],
					type: SplitPathKind.MdFile,
				},
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
					type: SplitPathKind.MdFile,
				},
				kind: VaultEventKind.FileRenamed,
				to: {
					basename: "New",
					extension: MD,
					pathParts: ["Another"],
					type: SplitPathKind.MdFile,
				},
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
				kind: VaultEventKind.FileDeleted,
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Library", "Section"],
					type: SplitPathKind.MdFile,
				},
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library", "Section"]);
		});

		it("returns Outside when file is outside library", () => {
			const event: VaultEvent = {
				kind: VaultEventKind.FileDeleted,
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: ["Other"],
					type: SplitPathKind.MdFile,
				},
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});
	});

	describe("FolderCreated", () => {
		it("returns InsideToInside when folder is inside library", () => {
			const event: VaultEvent = {
				kind: VaultEventKind.FolderCreated,
				splitPath: {
					basename: "Section",
					pathParts: ["Library"],
					type: SplitPathKind.Folder,
				},
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library"]);
		});

		it("returns Outside when folder is outside library", () => {
			const event: VaultEvent = {
				kind: VaultEventKind.FolderCreated,
				splitPath: {
					basename: "Section",
					pathParts: ["Other"],
					type: SplitPathKind.Folder,
				},
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
					type: SplitPathKind.Folder,
				},
				kind: VaultEventKind.FolderRenamed,
				to: {
					basename: "New",
					pathParts: ["Library"],
					type: SplitPathKind.Folder,
				},
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
					type: SplitPathKind.Folder,
				},
				kind: VaultEventKind.FolderRenamed,
				to: {
					basename: "New",
					pathParts: ["Other"],
					type: SplitPathKind.Folder,
				},
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
					type: SplitPathKind.Folder,
				},
				kind: VaultEventKind.FolderRenamed,
				to: {
					basename: "New",
					pathParts: ["Library"],
					type: SplitPathKind.Folder,
				},
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
					type: SplitPathKind.Folder,
				},
				kind: VaultEventKind.FolderRenamed,
				to: {
					basename: "New",
					pathParts: ["Another"],
					type: SplitPathKind.Folder,
				},
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
				kind: VaultEventKind.FolderDeleted,
				splitPath: {
					basename: "Section",
					pathParts: ["Library"],
					type: SplitPathKind.Folder,
				},
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Inside);
			expect(result.splitPath.pathParts).toEqual(["Library"]);
		});

		it("returns Outside when folder is outside library", () => {
			const event: VaultEvent = {
				kind: VaultEventKind.FolderDeleted,
				splitPath: {
					basename: "Section",
					pathParts: ["Other"],
					type: SplitPathKind.Folder,
				},
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});
	});

	describe("edge cases", () => {
		it("returns Outside when path shorter than library root", () => {
			const event: VaultEvent = {
				kind: VaultEventKind.FileCreated,
				splitPath: {
					basename: "Note",
					extension: MD,
					pathParts: [],
					type: SplitPathKind.MdFile,
				},
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});

		it("returns Outside when path that starts with library root but is not inside", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettingsForUnitTests,
				splitPathToLibraryRoot: {
					basename: "Library",
					pathParts: [],
					type: SplitPathKind.Folder,
				},
			});

			const event: VaultEvent = {
				kind: VaultEventKind.FileCreated,
				splitPath: {
					basename: "LibraryNote",
					extension: MD,
					pathParts: [],
					type: SplitPathKind.MdFile,
				},
			};

			const result = makeEventLibraryScoped(event);

			expect(result.scope).toBe(Scope.Outside);
			expect(result.splitPath).toEqual(event.splitPath);
		});
	});
});

