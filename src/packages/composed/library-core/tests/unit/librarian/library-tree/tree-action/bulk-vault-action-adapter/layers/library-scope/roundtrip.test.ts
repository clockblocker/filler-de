import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type spyOn,
} from "bun:test";
import type { VaultEvent } from "@textfresser/vault-action-manager";
import {
	MD,
	SplitPathKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { makeCodecRulesFromSettings } from "../../../../../../../../src/codecs";
import { makeLibraryScope } from "../../../../../../../../src/tree/library-scope";
import { defaultSettingsForUnitTests } from "../../../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
const libraryScope = makeLibraryScope(rules);

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("makeLibraryScope Vault ↔ Library round trips", () => {
	it("roundtrips a split path through the configured root", () => {
		const original = {
			basename: "Note",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "Section"],
		};

		const scoped = libraryScope.toLibraryPath(original);
		expect(scoped.isOk()).toBe(true);
		if (scoped.isErr()) return;

		expect(libraryScope.toVaultPath(scoped.value)).toEqual(original);
	});

	it("roundtrips FileCreated inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FileCreated,
			splitPath: {
				basename: "Note",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			},
		};

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1"],
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section2"],
			},
		};

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed inside to outside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Other"],
			},
		};

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileRenamed outside to inside", () => {
		const original: VaultEvent = {
			from: {
				basename: "Old",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Other"],
			},
			kind: VaultEventKind.FileRenamed,
			to: {
				basename: "New",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			},
		};

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

		expect(restored).toEqual(original);
	});

	it("roundtrips FileDeleted inside library", () => {
		const original: VaultEvent = {
			kind: VaultEventKind.FileDeleted,
			splitPath: {
				basename: "Note",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			},
		};

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

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

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

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

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

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

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

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

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

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

		const scoped = libraryScope.toLibraryEvent(original);
		const restored = libraryScope.toVaultEvent(scoped);

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
		const nestedLibraryScope = makeLibraryScope(testRules);

		const original: VaultEvent = {
			kind: VaultEventKind.FileCreated,
			splitPath: {
				basename: "Note",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Root", "Library", "Section"],
			},
		};

		const scoped = nestedLibraryScope.toLibraryEvent(original);
		const restored = nestedLibraryScope.toVaultEvent(scoped);

		expect(restored).toEqual(original);
	});
});
