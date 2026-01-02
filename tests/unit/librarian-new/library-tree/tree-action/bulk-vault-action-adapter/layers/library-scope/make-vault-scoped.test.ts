import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeVaultScoped } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/make-vault-scoped";
import type { LibraryScopedVaultEvent } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
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

describe("makeVaultScoped", () => {
	describe("OutsideToOutside scope", () => {
		it("returns event unchanged for FileCreated", () => {
			const event: VaultEvent = {
				splitPath: {
					basename: "Note",
					extension: "md",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
				},
				type: VaultEventType.FileCreated,
			};

			const scopedEvent: LibraryScopedVaultEvent = {
				event,
				scope: Scope.OutsideToOutside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result).toEqual(event);
		});

		it("returns event unchanged for FileRenamed", () => {
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

			const scopedEvent: LibraryScopedVaultEvent = {
				event,
				scope: Scope.OutsideToOutside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result).toEqual(event);
		});
	});

	describe("InsideToInside scope", () => {
		it("makes absolute path for FileCreated", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					splitPath: {
						basename: "Note",
						extension: "md",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
					},
					type: VaultEventType.FileCreated,
				},
				scope: Scope.InsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileCreated);
			if (result.type === VaultEventType.FileCreated) {
				expect(result.splitPath.pathParts).toEqual(["Library", "Section"]);
				expect(result.splitPath.basename).toBe("Note");
			}
		});

		it("makes absolute paths for FileRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					from: {
						basename: "Old",
						extension: "md",
						pathParts: ["Section1"],
						type: SplitPathType.MdFile,
					},
					to: {
						basename: "New",
						extension: "md",
						pathParts: ["Section2"],
						type: SplitPathType.MdFile,
					},
					type: VaultEventType.FileRenamed,
				},
				scope: Scope.InsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileRenamed);
			if (result.type === VaultEventType.FileRenamed) {
				expect(result.from.pathParts).toEqual(["Library", "Section1"]);
				expect(result.to.pathParts).toEqual(["Library", "Section2"]);
			}
		});

		it("makes absolute path for FileDeleted", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					splitPath: {
						basename: "Note",
						extension: "md",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
					},
					type: VaultEventType.FileDeleted,
				},
				scope: Scope.InsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileDeleted);
			if (result.type === VaultEventType.FileDeleted) {
				expect(result.splitPath.pathParts).toEqual(["Library", "Section"]);
			}
		});

		it("makes absolute path for FolderCreated", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					splitPath: {
						basename: "Section",
						pathParts: [],
						type: SplitPathType.Folder,
					},
					type: VaultEventType.FolderCreated,
				},
				scope: Scope.InsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FolderCreated);
			if (result.type === VaultEventType.FolderCreated) {
				expect(result.splitPath.pathParts).toEqual(["Library"]);
				expect(result.splitPath.basename).toBe("Section");
			}
		});

		it("makes absolute paths for FolderRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					from: {
						basename: "Old",
						pathParts: [],
						type: SplitPathType.Folder,
					},
					to: {
						basename: "New",
						pathParts: [],
						type: SplitPathType.Folder,
					},
					type: VaultEventType.FolderRenamed,
				},
				scope: Scope.InsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FolderRenamed);
			if (result.type === VaultEventType.FolderRenamed) {
				expect(result.from.pathParts).toEqual(["Library"]);
				expect(result.to.pathParts).toEqual(["Library"]);
			}
		});

		it("makes absolute path for FolderDeleted", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					splitPath: {
						basename: "Section",
						pathParts: [],
						type: SplitPathType.Folder,
					},
					type: VaultEventType.FolderDeleted,
				},
				scope: Scope.InsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FolderDeleted);
			if (result.type === VaultEventType.FolderDeleted) {
				expect(result.splitPath.pathParts).toEqual(["Library"]);
			}
		});
	});

	describe("InsideToOutside scope", () => {
		it("makes absolute path for from in FileRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					from: {
						basename: "Old",
						extension: "md",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
					},
					to: {
						basename: "New",
						extension: "md",
						pathParts: ["Other"],
						type: SplitPathType.MdFile,
					},
					type: VaultEventType.FileRenamed,
				},
				scope: Scope.InsideToOutside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileRenamed);
			if (result.type === VaultEventType.FileRenamed) {
				expect(result.from.pathParts).toEqual(["Library", "Section"]);
				expect(result.to.pathParts).toEqual(["Other"]);
			}
		});

		it("makes absolute path for from in FolderRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					from: {
						basename: "Old",
						pathParts: [],
						type: SplitPathType.Folder,
					},
					to: {
						basename: "New",
						pathParts: ["Other"],
						type: SplitPathType.Folder,
					},
					type: VaultEventType.FolderRenamed,
				},
				scope: Scope.InsideToOutside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FolderRenamed);
			if (result.type === VaultEventType.FolderRenamed) {
				expect(result.from.pathParts).toEqual(["Library"]);
				expect(result.to.pathParts).toEqual(["Other"]);
			}
		});
	});

	describe("OutsideToInside scope", () => {
		it("makes absolute path for to in FileRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					from: {
						basename: "Old",
						extension: "md",
						pathParts: ["Other"],
						type: SplitPathType.MdFile,
					},
					to: {
						basename: "New",
						extension: "md",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
					},
					type: VaultEventType.FileRenamed,
				},
				scope: Scope.OutsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileRenamed);
			if (result.type === VaultEventType.FileRenamed) {
				expect(result.from.pathParts).toEqual(["Other"]);
				expect(result.to.pathParts).toEqual(["Library", "Section"]);
			}
		});

		it("makes absolute path for to in FolderRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					from: {
						basename: "Old",
						pathParts: ["Other"],
						type: SplitPathType.Folder,
					},
					to: {
						basename: "New",
						pathParts: [],
						type: SplitPathType.Folder,
					},
					type: VaultEventType.FolderRenamed,
				},
				scope: Scope.OutsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FolderRenamed);
			if (result.type === VaultEventType.FolderRenamed) {
				expect(result.from.pathParts).toEqual(["Other"]);
				expect(result.to.pathParts).toEqual(["Library"]);
			}
		});
	});

	describe("nested library root", () => {
		it("handles nested library root path", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				splitPathToLibraryRoot: {
					basename: "Library",
					pathParts: ["Root"],
					type: SplitPathType.Folder,
				},
			});

			const scopedEvent: LibraryScopedVaultEvent = {
				event: {
					splitPath: {
						basename: "Note",
						extension: "md",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
					},
					type: VaultEventType.FileCreated,
				},
				scope: Scope.InsideToInside,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileCreated);
			if (result.type === VaultEventType.FileCreated) {
				expect(result.splitPath.pathParts).toEqual(["Root", "Library", "Section"]);
			}
		});
	});
});

