import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeEventLibraryScoped } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/events/make-event-libray-scoped";
import { makeEventVaultScoped } from "../../../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/events/make-event-vault-scoped";
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

describe("makeEventLibraryScoped and makeEventVaultScoped roundtrip", () => {
	it("roundtrips FileCreated inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FileCreated,
			splitPath: {
				basename: "Note",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathKind.MdFile,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				pathParts: ["Library", "Section1"],
				type: SplitPathKind.MdFile,
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: "md",
				pathParts: ["Library", "Section2"],
				type: SplitPathKind.MdFile,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to outside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathKind.MdFile,
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: "md",
				pathParts: ["Other"],
				type: SplitPathKind.MdFile,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed outside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				pathParts: ["Other"],
				type: SplitPathKind.MdFile,
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathKind.MdFile,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileDeleted inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FileDeleted,
			splitPath: {
				basename: "Note",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathKind.MdFile,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderCreated inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FolderCreated,
			splitPath: {
				basename: "Section",
				pathParts: ["Library"],
				type: SplitPathKind.Folder,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed inside to inside", () => {
		const original: VaultEvent = {
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

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed inside to outside", () => {
		const original: VaultEvent = {
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

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed outside to inside", () => {
		const original: VaultEvent = {
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

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderDeleted inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FolderDeleted,
			splitPath: {
				basename: "Section",
				pathParts: ["Library"],
				type: SplitPathKind.Folder,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips with nested library root", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettingsForUnitTests,
			splitPathToLibraryRoot: {
				basename: "Library",
				pathParts: ["Root"],
				type: SplitPathKind.Folder,
			},
		});

		const original: VaultEvent = {
			kind: VaultEventKind.FileCreated,
			splitPath: {
				basename: "Note",
				extension: "md",
				pathParts: ["Root", "Library", "Section"],
				type: SplitPathKind.MdFile,
			},
		};

		const scoped = makeEventLibraryScoped(original);
		const restored = makeEventVaultScoped(scoped);

		expect(restored).toEqual(original);
	});
});

