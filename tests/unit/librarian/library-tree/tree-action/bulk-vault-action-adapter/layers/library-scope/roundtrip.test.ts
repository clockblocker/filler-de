import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeCodecRulesFromSettings } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/codecs";
import { makeEventLibraryScoped } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/events/make-event-libray-scoped";
import { makeEventVaultScoped } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/events/make-event-vault-scoped";
import { SplitPathKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type { VaultEvent } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { defaultSettingsForUnitTests } from "../../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("makeEventLibraryScoped and makeEventVaultScoped roundtrip", () => {
	it("roundtrips FileCreated inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FileCreated,
			splitPath: {
				basename: "Note",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1"],
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section2"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to outside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Other"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed outside to inside", () => {
		const original: VaultEvent = {
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
				pathParts: ["Library", "Section"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileDeleted inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FileDeleted,
			splitPath: {
				basename: "Note",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderCreated inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FolderCreated,
			splitPath: {
				basename: "Section",
				kind: SplitPathKind.Folder,
				pathParts: ["Library"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed inside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				kind: SplitPathKind.Folder,
				pathParts: ["Library"],
			},
			kind: VaultEventKind.FolderRenamed,
			to: {
				basename: "New",
				kind: SplitPathKind.Folder,
				pathParts: ["Library"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed inside to outside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				kind: SplitPathKind.Folder,
				pathParts: ["Library"],
			},
			kind: VaultEventKind.FolderRenamed,
			to: {
				basename: "New",
				kind: SplitPathKind.Folder,
				pathParts: ["Other"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed outside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				kind: SplitPathKind.Folder,
				pathParts: ["Other"],
			},
			kind: VaultEventKind.FolderRenamed,
			to: {
				basename: "New",
				kind: SplitPathKind.Folder,
				pathParts: ["Library"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderDeleted inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FolderDeleted,
			splitPath: {
				basename: "Section",
				kind: SplitPathKind.Folder,
				pathParts: ["Library"],
			},
		};

		const scoped = makeEventLibraryScoped(original, rules);
		const restored = makeEventVaultScoped(scoped, rules);

		expect(restored).toEqual(original);
	});

	it("roundtrips with nested library root", () => {
		const mockedSettings = {
			...defaultSettingsForUnitTests,
			splitPathToLibraryRoot: {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: ["Root"],
			},
		};
		getParsedUserSettingsSpy.mockReturnValue(mockedSettings);
		const testRules = makeCodecRulesFromSettings(mockedSettings);

		const original: VaultEvent = {
			kind: VaultEventKind.FileCreated,
			splitPath: {
				basename: "Note",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Root", "Library", "Section"],
			},
		};

		const scoped = makeEventLibraryScoped(original, testRules);
		const restored = makeEventVaultScoped(scoped, testRules);

		expect(restored).toEqual(original);
	});
});

