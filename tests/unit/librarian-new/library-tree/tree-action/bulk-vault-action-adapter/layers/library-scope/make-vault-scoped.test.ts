import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeVaultScoped } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/make-vault-scoped";
import { Scope } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types";
import type { LibraryScopedVaultEvent } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types";
import * as globalState from "../../../../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../../../../src/obsidian-vault-action-manager/types/split-path";
import { VaultEventType } from "../../../../../../../../src/obsidian-vault-action-manager/types/vault-event";
import type { VaultEvent } from "../../../../../../../../src/obsidian-vault-action-manager/types/vault-event";

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
				type: VaultEventType.FileCreated,
				splitPath: {
					basename: "Note",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
					extension: "md",
				},
			};

			const scopedEvent: LibraryScopedVaultEvent = {
				scope: Scope.OutsideToOutside,
				event,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result).toEqual(event);
		});

		it("returns event unchanged for FileRenamed", () => {
			const event: VaultEvent = {
				type: VaultEventType.FileRenamed,
				from: {
					basename: "Old",
					pathParts: ["Other"],
					type: SplitPathType.MdFile,
					extension: "md",
				},
				to: {
					basename: "New",
					pathParts: ["Another"],
					type: SplitPathType.MdFile,
					extension: "md",
				},
			};

			const scopedEvent: LibraryScopedVaultEvent = {
				scope: Scope.OutsideToOutside,
				event,
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result).toEqual(event);
		});
	});

	describe("InsideToInside scope", () => {
		it("makes absolute path for FileCreated", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				scope: Scope.InsideToInside,
				event: {
					type: VaultEventType.FileCreated,
					splitPath: {
						basename: "Note",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
				},
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
				scope: Scope.InsideToInside,
				event: {
					type: VaultEventType.FileRenamed,
					from: {
						basename: "Old",
						pathParts: ["Section1"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
					to: {
						basename: "New",
						pathParts: ["Section2"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
				},
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
				scope: Scope.InsideToInside,
				event: {
					type: VaultEventType.FileDeleted,
					splitPath: {
						basename: "Note",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
				},
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileDeleted);
			if (result.type === VaultEventType.FileDeleted) {
				expect(result.splitPath.pathParts).toEqual(["Library", "Section"]);
			}
		});

		it("makes absolute path for FolderCreated", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				scope: Scope.InsideToInside,
				event: {
					type: VaultEventType.FolderCreated,
					splitPath: {
						basename: "Section",
						pathParts: [],
						type: SplitPathType.Folder,
					},
				},
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
				scope: Scope.InsideToInside,
				event: {
					type: VaultEventType.FolderRenamed,
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
				},
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
				scope: Scope.InsideToInside,
				event: {
					type: VaultEventType.FolderDeleted,
					splitPath: {
						basename: "Section",
						pathParts: [],
						type: SplitPathType.Folder,
					},
				},
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
				scope: Scope.InsideToOutside,
				event: {
					type: VaultEventType.FileRenamed,
					from: {
						basename: "Old",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
					to: {
						basename: "New",
						pathParts: ["Other"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
				},
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
				scope: Scope.InsideToOutside,
				event: {
					type: VaultEventType.FolderRenamed,
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
				},
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
				scope: Scope.OutsideToInside,
				event: {
					type: VaultEventType.FileRenamed,
					from: {
						basename: "Old",
						pathParts: ["Other"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
					to: {
						basename: "New",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
				},
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
				scope: Scope.OutsideToInside,
				event: {
					type: VaultEventType.FolderRenamed,
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
				},
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
				scope: Scope.InsideToInside,
				event: {
					type: VaultEventType.FileCreated,
					splitPath: {
						basename: "Note",
						pathParts: ["Section"],
						type: SplitPathType.MdFile,
						extension: "md",
					},
				},
			};

			const result = makeVaultScoped(scopedEvent);

			expect(result.type).toBe(VaultEventType.FileCreated);
			if (result.type === VaultEventType.FileCreated) {
				expect(result.splitPath.pathParts).toEqual(["Root", "Library", "Section"]);
			}
		});
	});
});

