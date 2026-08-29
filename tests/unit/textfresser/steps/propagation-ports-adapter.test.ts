import { describe, expect, it } from "bun:test";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	VamVaultIoError,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect, Result } from "effect";
import {
	createPropagationPortsAdapter,
} from "../../../../src/commanders/textfresser/commands/generate/steps/propagation-ports-adapter";

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

function readError(reason: string) {
	return new VamVaultIoError({
		cause: new Error(reason),
		operation: "readContent",
	});
}

describe("propagation-ports-adapter", () => {
	it("readManyMdFiles deduplicates input and preserves deterministic first-seen order", async () => {
		const alpha = makePath("alpha");
		const beta = makePath("beta");
		const existsCalls: string[] = [];
		const readCalls: string[] = [];

		const vam: VamPortDependency = {
			exists: (splitPath) => {
				return Effect.sync(() => {
					existsCalls.push(splitPath.basename);
					return true;
				});
			},
			findByBasename: () => Effect.succeed([]),
			readContent: (splitPath) => Effect.sync(() => {
					readCalls.push(splitPath.basename);
					return `content:${splitPath.basename}`;
				}),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await Effect.runPromise(ports.vault.readManyMdFiles([
			beta,
			alpha,
			beta,
			alpha,
		]));

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
			exists: () => Effect.succeed(false),
			findByBasename: () => Effect.succeed([]),
			readContent: () => Effect.sync(() => {
					readAttempted = true;
					return "unreachable";
				}),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await Effect.runPromise(ports.vault.readManyMdFiles([alpha]));
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
			exists: () => Effect.succeed(true),
			findByBasename: () => Effect.succeed([]),
			readContent: () => Effect.fail(readError("File not found: alpha")),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await Effect.runPromise(ports.vault.readManyMdFiles([alpha]));
		expect(results).toEqual([{ kind: "Missing", splitPath: alpha }]);
	});

	it("readManyMdFiles classifies vanished file as Missing even without file-not-found wording", async () => {
		const alpha = makePath("alpha");
		let existsCalls = 0;

		const vam: VamPortDependency = {
			exists: () => {
				return Effect.sync(() => {
					existsCalls++;
					return existsCalls === 1;
				});
			},
			findByBasename: () => Effect.succeed([]),
			readContent: () => Effect.fail(readError("random io issue")),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await Effect.runPromise(ports.vault.readManyMdFiles([alpha]));
		expect(results).toEqual([{ kind: "Missing", splitPath: alpha }]);
	});

	it("readManyMdFiles returns Error for non-missing read failures", async () => {
		const alpha = makePath("alpha");
		const permissionError = readError("permission denied");

		const vam: VamPortDependency = {
			exists: () => Effect.succeed(true),
			findByBasename: () => Effect.succeed([]),
			readContent: () => Effect.fail(permissionError),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const results = await Effect.runPromise(ports.vault.readManyMdFiles([alpha]));
		expect(results).toEqual([
			{
				kind: "Error",
				reason: permissionError,
				splitPath: alpha,
			},
		]);
	});

	it("readNoteOrEmpty returns ok('') for missing path and for race-safe missing reads", async () => {
		const alpha = makePath("alpha");
		const beta = makePath("beta");

		const vamMissing: VamPortDependency = {
			exists: () => Effect.succeed(false),
			findByBasename: () => Effect.succeed([]),
			readContent: () => Effect.fail(readError("unreachable")),
		};
		const portsMissing = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam: vamMissing,
		});
		const missingResult = await Effect.runPromise(
			portsMissing.vault.readNoteOrEmpty(alpha).pipe(Effect.result),
		);
		expect(Result.isSuccess(missingResult)).toBe(true);
		if (Result.isFailure(missingResult)) return;
		expect(missingResult.success).toBe("");

		const vamRace: VamPortDependency = {
			exists: () => Effect.succeed(true),
			findByBasename: () => Effect.succeed([]),
			readContent: () => Effect.fail(readError("File not found: beta")),
		};
		const portsRace = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam: vamRace,
		});
		const raceResult = await Effect.runPromise(
			portsRace.vault.readNoteOrEmpty(beta).pipe(Effect.result),
		);
		expect(Result.isSuccess(raceResult)).toBe(true);
		if (Result.isFailure(raceResult)) return;
		expect(raceResult.success).toBe("");
	});

	it("readNoteOrEmpty returns Err for non-missing read failures", async () => {
		const alpha = makePath("alpha");

		const vam: VamPortDependency = {
			exists: () => Effect.succeed(true),
			findByBasename: () => Effect.succeed([]),
			readContent: () => Effect.fail(readError("permission denied")),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [],
			vam,
		});

		const result = await Effect.runPromise(
			ports.vault.readNoteOrEmpty(alpha).pipe(Effect.result),
		);
		expect(Result.isFailure(result)).toBe(true);
		if (Result.isSuccess(result)) return;
		expect(result.failure).toContain("permission denied");
	});

	it("findCandidateTargets uses only basename + library core-name lookup and dedupes", async () => {
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
			exists: () => Effect.succeed(true),
			findByBasename: (basename, opts) => {
				return Effect.sync(() => {
					capturedBasename = basename;
					capturedFolder = opts?.folder;
					return [shared, fromVamOnly];
				});
			},
			readContent: () => Effect.succeed(""),
		};

		const ports = createPropagationPortsAdapter({
			lookupInLibraryByCoreName: () => [shared, fromLibraryOnly],
			vam,
		});

		const targets = await Effect.runPromise(ports.vault.findCandidateTargets({
			basename: "machen",
			folder,
		}));

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
				exists: () => Effect.succeed(true),
				findByBasename: () => Effect.succeed([]),
				readContent: () => Effect.succeed(""),
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
