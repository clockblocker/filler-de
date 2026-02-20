import { describe, expect, it } from "bun:test";
import { err, ok } from "neverthrow";
import {
	createPropagationPortsAdapter,
} from "../../../../src/commanders/textfresser/commands/generate/steps/propagation-ports-adapter";
import {
	ReadContentErrorKind,
	type VaultActionManager,
} from "../../../../src/managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
} from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

type VamPortDependency = Pick<
	VaultActionManager,
	"exists" | "findByBasename" | "readContent"
>;

function makePath(
	basename: string,
	pathParts: string[] = ["Worter", "de", "lexem", "lemma"],
): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
	};
}

function fileNotFoundError(reason: string) {
	return {
		kind: ReadContentErrorKind.FileNotFound,
		reason,
	} as const;
}

function unknownReadError(reason: string) {
	return {
		kind: ReadContentErrorKind.Unknown,
		reason,
	} as const;
}

function permissionReadError(reason: string) {
	return {
		kind: ReadContentErrorKind.PermissionDenied,
		reason,
	} as const;
}

describe("propagation-ports-adapter", () => {
	it("readManyMdFiles deduplicates input and preserves deterministic first-seen order", async () => {
		const alpha = makePath("alpha");
		const beta = makePath("beta");
		const existsCalls: string[] = [];
		const readCalls: string[] = [];

		const vam: VamPortDependency = {
			exists: (splitPath) => {
				existsCalls.push(splitPath.basename);
				return true;
			},
			findByBasename: () => [],
			readContent: async (splitPath) => {
				readCalls.push(splitPath.basename);
				return ok(`content:${splitPath.basename}`);
			},
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await ports.vault.readManyMdFiles([
			beta,
			alpha,
			beta,
			alpha,
		]);

		expect(results).toHaveLength(2);
		expect(results[0]?.kind).toBe("Found");
		expect(results[0]?.splitPath.basename).toBe("beta");
		expect(results[1]?.kind).toBe("Found");
		expect(results[1]?.splitPath.basename).toBe("alpha");
		expect(existsCalls).toEqual(["beta", "alpha"]);
		expect(readCalls).toEqual(["beta", "alpha"]);
	});

	it("readManyMdFiles returns Missing when file does not exist", async () => {
		const alpha = makePath("alpha");
		let readAttempted = false;

		const vam: VamPortDependency = {
			exists: () => false,
			findByBasename: () => [],
			readContent: async () => {
				readAttempted = true;
				return err(unknownReadError("read should not be called"));
			},
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await ports.vault.readManyMdFiles([alpha]);
		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			kind: "Missing",
			splitPath: alpha,
		});
		expect(readAttempted).toBe(false);
	});

	it("readManyMdFiles classifies readContent 'File not found' as Missing (race-safe)", async () => {
		const alpha = makePath("alpha");

		const vam: VamPortDependency = {
			exists: () => true,
			findByBasename: () => [],
			readContent: async () =>
				err(fileNotFoundError("File not found: alpha")),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await ports.vault.readManyMdFiles([alpha]);
		expect(results).toEqual([{ kind: "Missing", splitPath: alpha }]);
	});

	it("readManyMdFiles classifies vanished file as Missing even without file-not-found wording", async () => {
		const alpha = makePath("alpha");
		let existsCalls = 0;

		const vam: VamPortDependency = {
			exists: () => {
				existsCalls++;
				return existsCalls === 1;
			},
			findByBasename: () => [],
			readContent: async () => err(unknownReadError("random io issue")),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await ports.vault.readManyMdFiles([alpha]);
		expect(results).toEqual([{ kind: "Missing", splitPath: alpha }]);
	});

	it("readManyMdFiles returns Error for non-missing read failures", async () => {
		const alpha = makePath("alpha");

		const vam: VamPortDependency = {
			exists: () => true,
			findByBasename: () => [],
			readContent: async () =>
				err(permissionReadError("permission denied")),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await ports.vault.readManyMdFiles([alpha]);
		expect(results).toEqual([
			{
				kind: "Error",
				reason: permissionReadError("permission denied"),
				splitPath: alpha,
			},
		]);
	});

	it("readNoteOrEmpty returns ok('') for missing path and for race-safe missing reads", async () => {
		const alpha = makePath("alpha");
		const beta = makePath("beta");

		const vamMissing: VamPortDependency = {
			exists: () => false,
			findByBasename: () => [],
			readContent: async () => err(unknownReadError("unreachable")),
		};
		const portsMissing = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam: vamMissing,
		});
		const missingResult = await portsMissing.vault.readNoteOrEmpty(alpha);
		expect(missingResult.isOk()).toBe(true);
		if (missingResult.isErr()) return;
		expect(missingResult.value).toBe("");

		const vamRace: VamPortDependency = {
			exists: () => true,
			findByBasename: () => [],
			readContent: async () =>
				err(fileNotFoundError("File not found: beta")),
		};
		const portsRace = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam: vamRace,
		});
		const raceResult = await portsRace.vault.readNoteOrEmpty(beta);
		expect(raceResult.isOk()).toBe(true);
		if (raceResult.isErr()) return;
		expect(raceResult.value).toBe("");
	});

	it("readNoteOrEmpty returns Err for non-missing read failures", async () => {
		const alpha = makePath("alpha");

		const vam: VamPortDependency = {
			exists: () => true,
			findByBasename: () => [],
			readContent: async () =>
				err(permissionReadError("permission denied")),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const result = await ports.vault.readNoteOrEmpty(alpha);
		expect(result.isErr()).toBe(true);
		if (result.isOk()) return;
		expect(result.error).toBe("permission denied");
	});

	it("findCandidateTargets uses only basename + library core-name lookup and dedupes", () => {
		const folder: SplitPathToFolder = {
			basename: "lemma",
			kind: SplitPathKind.Folder,
			pathParts: ["Worter", "de", "lexem"],
		};
		const shared = makePath("machen");
		const fromVamOnly = makePath("machen", ["Worter", "de", "lexem", "lemma", "m"]);
		const fromLibraryOnly = makePath("machen", ["Library", "de", "verb"]);
		let capturedBasename: string | null = null;
		let capturedFolder: SplitPathToFolder | undefined;

		const vam: VamPortDependency = {
			exists: () => true,
			findByBasename: (basename, opts) => {
				capturedBasename = basename;
				capturedFolder = opts?.folder;
				return [shared, fromVamOnly];
			},
			readContent: async () => ok(""),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [shared, fromLibraryOnly],
			vam,
		});

		const targets = ports.vault.findCandidateTargets({
			basename: "machen",
			folder,
		});

		if (!capturedBasename) {
			throw new Error("findByBasename was not called");
		}
		expect(capturedBasename === "machen").toBe(true);
		expect(capturedFolder).toEqual(folder);
		expect(targets).toEqual([shared, fromVamOnly, fromLibraryOnly]);
	});

	it("buildTargetWriteActions returns sync upsert/process action pair", () => {
		const alpha = makePath("alpha");
		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam: {
				exists: () => true,
				findByBasename: () => [],
				readContent: async () => ok(""),
			},
		});

		const actions = ports.vault.buildTargetWriteActions({
			splitPath: alpha,
			transform: (content: string) => `${content}\nmutated`,
		});

		expect(actions).toHaveLength(2);
		const upsertAction = actions[0];
		const processAction = actions[1];
		if (!upsertAction || !processAction) return;

		expect(upsertAction.kind).toBe(VaultActionKind.UpsertMdFile);
		expect(upsertAction.payload).toEqual({
			content: null,
			splitPath: alpha,
		});

		expect(processAction.kind).toBe(VaultActionKind.ProcessMdFile);
		const payload = processAction.payload;
		if (!("transform" in payload)) return;
		expect(payload.splitPath).toEqual(alpha);
		expect(payload.transform("x")).toBe("x\nmutated");
	});
});
