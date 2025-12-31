import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeLibraryScopedVaultEvent } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/make-library-scoped-vault-event";
import { makeVaultScoped } from "../../../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/make-vault-scoped";
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

describe("makeLibraryScopedVaultEvent and makeVaultScoped roundtrip", () => {
	it("roundtrips FileCreated inside library", () => {
		const original: VaultEvent = {
			splitPath: {
				basename: "Note",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathType.MdFile,
			},
			type: VaultEventType.FileCreated,
		};

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				pathParts: ["Library", "Section1"],
				type: SplitPathType.MdFile,
			},
			to: {
				basename: "New",
				extension: "md",
				pathParts: ["Library", "Section2"],
				type: SplitPathType.MdFile,
			},
			type: VaultEventType.FileRenamed,
		};

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to outside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				pathParts: ["Library", "Section"],
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

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed outside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: "md",
				pathParts: ["Other"],
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

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileDeleted inside library", () => {
		const original: VaultEvent = {
			splitPath: {
				basename: "Note",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathType.MdFile,
			},
			type: VaultEventType.FileDeleted,
		};

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderCreated inside library", () => {
		const original: VaultEvent = {
			splitPath: {
				basename: "Section",
				pathParts: ["Library"],
				type: SplitPathType.Folder,
			},
			type: VaultEventType.FolderCreated,
		};

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed inside to inside", () => {
		const original: VaultEvent = {
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

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed inside to outside", () => {
		const original: VaultEvent = {
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

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderRenamed outside to inside", () => {
		const original: VaultEvent = {
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

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FolderDeleted inside library", () => {
		const original: VaultEvent = {
			splitPath: {
				basename: "Section",
				pathParts: ["Library"],
				type: SplitPathType.Folder,
			},
			type: VaultEventType.FolderDeleted,
		};

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips with nested library root", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			splitPathToLibraryRoot: {
				basename: "Library",
				pathParts: ["Root"],
				type: SplitPathType.Folder,
			},
		});

		const original: VaultEvent = {
			splitPath: {
				basename: "Note",
				extension: "md",
				pathParts: ["Root", "Library", "Section"],
				type: SplitPathType.MdFile,
			},
			type: VaultEventType.FileCreated,
		};

		const scoped = makeLibraryScopedVaultEvent(original);
		const restored = makeVaultScoped(scoped);

		expect(restored).toEqual(original);
	});
});

