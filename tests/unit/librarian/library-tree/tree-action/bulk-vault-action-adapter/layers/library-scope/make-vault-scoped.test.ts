import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeCodecRulesFromSettings } from "../../../../../../../../src/commanders/librarian-new/codecs";
import { makeEventVaultScoped } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/events/make-event-vault-scoped";
import type { LibraryScopedVaultEvent } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import { Scope } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/scoped-event";
import { SplitPathKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultEvent } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { defaultSettingsForUnitTests } from "../../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
let rules: ReturnType<typeof makeCodecRulesFromSettings>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
	rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("makeEventVaultScoped", () => {
	describe("Outside scope", () => {
		it("returns event unchanged for FileRenamed", () => {
			const event: VaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Other"],
				},
				kind: VaultEventKind.FileRenamed,
				to: {
					basename: "New",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Another"],
				},
			};

			const scopedEvent: LibraryScopedVaultEvent = {
				...event,
				scope: Scope.Outside,
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result).toEqual(event);
		});

	});

	describe("InsideToInside scope", () => {
		it("makes absolute path for FileCreated", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				kind: VaultEventKind.FileCreated,
				scope: Scope.Inside,
				splitPath: {
					basename: "Note",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Section"],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FileCreated);
			if (result.kind === VaultEventKind.FileCreated) {
				expect(result.splitPath.pathParts).toEqual(["Section"]);
				expect(result.splitPath.basename).toBe("Note");
			}
		});

		it("makes absolute paths for FileRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Section1"],
				},
				kind: VaultEventKind.FileRenamed,
				scope: Scope.Inside,
				to: {
					basename: "New",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Section2"],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FileRenamed);
			if (result.kind === VaultEventKind.FileRenamed) {
				expect(result.from.pathParts).toEqual(["Section1"]);
				expect(result.to.pathParts).toEqual(["Section2"]);
			}
		});

		it("makes absolute path for FileDeleted", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				kind: VaultEventKind.FileDeleted,
				scope: Scope.Inside,
				splitPath: {
					basename: "Note",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Section"],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FileDeleted);
			if (result.kind === VaultEventKind.FileDeleted) {
				expect(result.splitPath.pathParts).toEqual(["Section"]);
			}
		});

		it("makes absolute path for FolderCreated", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				kind: VaultEventKind.FolderCreated,
				scope: Scope.Inside,
				splitPath: {
					basename: "Section",
					kind: SplitPathKind.Folder,
					pathParts: [],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FolderCreated);
			if (result.kind === VaultEventKind.FolderCreated) {
				expect(result.splitPath.pathParts).toEqual([]);
				expect(result.splitPath.basename).toBe("Section");
			}
		});

		it("makes absolute paths for FolderRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				from: {
					basename: "Old",
					kind: SplitPathKind.Folder,
					pathParts: [],
				},
				kind: VaultEventKind.FolderRenamed,
				scope: Scope.Inside,
				to: {
					basename: "New",
					kind: SplitPathKind.Folder,
					pathParts: [],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FolderRenamed);
			if (result.kind === VaultEventKind.FolderRenamed) {
				expect(result.from.pathParts).toEqual([]);
				expect(result.to.pathParts).toEqual([]);
			}
		});

		it("makes absolute path for FolderDeleted", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				kind: VaultEventKind.FolderDeleted,
				scope: Scope.Inside,
				splitPath: {
					basename: "Section",
					kind: SplitPathKind.Folder,
					pathParts: [],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FolderDeleted);
			if (result.kind === VaultEventKind.FolderDeleted) {
				expect(result.splitPath.pathParts).toEqual([]);
			}
		});
	});

	describe("InsideToOutside scope", () => {
		it("makes absolute path for from in FileRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Section"],
				},
				kind: VaultEventKind.FileRenamed,
				scope: Scope.InsideToOutside,
				to: {
					basename: "New",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Other"],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FileRenamed);
			if (result.kind === VaultEventKind.FileRenamed) {
				expect(result.from.pathParts).toEqual(["Section"]);
				expect(result.to.pathParts).toEqual(["Other"]);
			}
		});

		it("makes absolute path for from in FolderRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				from: {
					basename: "Old",
					kind: SplitPathKind.Folder,
					pathParts: [],
				},
				kind: VaultEventKind.FolderRenamed,
				scope: Scope.InsideToOutside,
				to: {
					basename: "New",
					kind: SplitPathKind.Folder,
					pathParts: ["Other"],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FolderRenamed);
			if (result.kind === VaultEventKind.FolderRenamed) {
				expect(result.from.pathParts).toEqual([]);
				expect(result.to.pathParts).toEqual(["Other"]);
			}
		});
	});

	describe("OutsideToInside scope", () => {
		it("makes absolute path for to in FileRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				from: {
					basename: "Old",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Other"],
				},
				kind: VaultEventKind.FileRenamed,
				scope: Scope.OutsideToInside,
				to: {
					basename: "New",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Section"],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FileRenamed);
			if (result.kind === VaultEventKind.FileRenamed) {
				expect(result.from.pathParts).toEqual(["Other"]);
				expect(result.to.pathParts).toEqual(["Section"]);
			}
		});

		it("makes absolute path for to in FolderRenamed", () => {
			const scopedEvent: LibraryScopedVaultEvent = {
				from: {
					basename: "Old",
					kind: SplitPathKind.Folder,
					pathParts: ["Other"],
				},
				kind: VaultEventKind.FolderRenamed,
				scope: Scope.OutsideToInside,
				to: {
					basename: "New",
					kind: SplitPathKind.Folder,
					pathParts: [],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, rules);

			expect(result.kind).toBe(VaultEventKind.FolderRenamed);
			if (result.kind === VaultEventKind.FolderRenamed) {
				expect(result.from.pathParts).toEqual(["Other"]);
				expect(result.to.pathParts).toEqual([]);
			}
		});
	});

	describe("nested library root", () => {
		it("handles nested library root path", () => {
			const nestedSettings = {
				...defaultSettingsForUnitTests,
				splitPathToLibraryRoot: {
					basename: "Library",
					kind: SplitPathKind.Folder,
					pathParts: ["Root"],
				},
			};
			getParsedUserSettingsSpy.mockReturnValue(nestedSettings);
			const nestedRules = makeCodecRulesFromSettings(nestedSettings);

			const scopedEvent: LibraryScopedVaultEvent = {
				kind: VaultEventKind.FileCreated,
				scope: Scope.Inside,
				splitPath: {
					basename: "Note",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Section"],
				},
			};

			const result = makeEventVaultScoped(scopedEvent, nestedRules);

			expect(result.kind).toBe(VaultEventKind.FileCreated);
			if (result.kind === VaultEventKind.FileCreated) {
				expect(result.splitPath.pathParts).toEqual(["Root", "Section"]);
			}
		});
	});
});

