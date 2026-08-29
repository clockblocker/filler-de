import type {
	SplitPathToMdFile,
	VamEffectError,
	VaultAction,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import {
	classifyReadContentError,
	makeSystemPathForSplitPath,
	ReadContentErrorKind,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect, Result } from "effect";
import { getErrorMessage } from "../../../../../utils/get-error-message";
import type { PathLookupFn } from "../../../common/target-path-resolver";
import type {
	FindCandidateTargetsParams,
	PropagationLibraryLookupPort,
	PropagationVaultPort,
	ReadManyMdFilesOutcome,
} from "../../../domain/propagation";

type VamPortDependency = Pick<
	VaultActionManager,
	"exists" | "findByBasename" | "readContent"
>;

export type CreatePropagationPortsAdapterParams = {
	vam: VamPortDependency;
	lookupInLibraryByCoreName: PathLookupFn;
};

export type PropagationPortsAdapter = {
	vault: PropagationVaultPort;
	libraryLookup: PropagationLibraryLookupPort;
};

export function createPropagationPortsAdapter(
	params: CreatePropagationPortsAdapterParams,
): PropagationPortsAdapter {
	const libraryLookup = createPropagationLibraryLookupPort(
		params.lookupInLibraryByCoreName,
	);
	const vault = createPropagationVaultPort({
		libraryLookup,
		vam: params.vam,
	});
	return { libraryLookup, vault };
}

export function createPropagationLibraryLookupPort(
	lookupInLibraryByCoreName: PathLookupFn,
): PropagationLibraryLookupPort {
	return {
		findByLeafCoreName(coreName: string): ReadonlyArray<SplitPathToMdFile> {
			return dedupeSplitPaths(lookupInLibraryByCoreName(coreName));
		},
	};
}

export function createPropagationVaultPort(params: {
	vam: VamPortDependency;
	libraryLookup: PropagationLibraryLookupPort;
}): PropagationVaultPort {
	const { libraryLookup, vam } = params;

	return {
		buildTargetWriteActions({
			splitPath,
			transform,
		}): readonly VaultAction[] {
			return [
				{
					kind: VaultActionKind.UpsertMdFile,
					payload: { content: null, splitPath },
				},
				{
					kind: VaultActionKind.ProcessMdFile,
					payload: { splitPath, transform },
				},
			];
		},

		exists(path) {
			return vam.exists(path);
		},

		findCandidateTargets(paramsArg: FindCandidateTargetsParams) {
			const findByBasenameOptions = paramsArg.folder
				? { folder: paramsArg.folder }
				: undefined;
			const byCoreName = libraryLookup.findByLeafCoreName(
				paramsArg.basename,
			);
			return vam
				.findByBasename(paramsArg.basename, findByBasenameOptions)
				.pipe(
					Effect.map((byBasename) =>
						dedupeSplitPaths([...byBasename, ...byCoreName]),
					),
				);
		},

		readManyMdFiles(paths: ReadonlyArray<SplitPathToMdFile>) {
			const uniquePaths = dedupeSplitPaths(paths);
			return Effect.all(
				uniquePaths.map((splitPath) =>
					readSinglePath({ splitPath, vam }),
				),
			);
		},
		readNoteOrEmpty(splitPath: SplitPathToMdFile) {
			return readSinglePath({ splitPath, vam }).pipe(
				Effect.flatMap((readOutcome) => {
					if (readOutcome.kind === "Found") {
						return Effect.succeed(readOutcome.content);
					}
					if (readOutcome.kind === "Missing") {
						return Effect.succeed("");
					}
					return Effect.fail(describeReadFailure(readOutcome.reason));
				}),
			);
		},
	};
}

const readSinglePath = Effect.fn("Textfresser.readPropagationPath")(
	function* (params: {
		splitPath: SplitPathToMdFile;
		vam: VamPortDependency;
	}): Effect.fn.Return<ReadManyMdFilesOutcome> {
		const { splitPath, vam } = params;

		const existsResult = yield* vam.exists(splitPath).pipe(Effect.result);
		if (Result.isFailure(existsResult)) {
			return { kind: "Error", reason: existsResult.failure, splitPath };
		}
		if (!existsResult.success) {
			return {
				kind: "Missing",
				splitPath,
			};
		}

		const readResult = yield* vam
			.readContent(splitPath)
			.pipe(Effect.result);
		if (Result.isSuccess(readResult)) {
			return {
				content: readResult.success,
				kind: "Found",
				splitPath,
			};
		}

		if (
			yield* isMissingAfterReadFailure(readResult.failure, splitPath, vam)
		) {
			return {
				kind: "Missing",
				splitPath,
			};
		}

		return {
			kind: "Error",
			reason: readResult.failure,
			splitPath,
		};
	},
);

function dedupeSplitPaths(
	paths: ReadonlyArray<SplitPathToMdFile>,
): SplitPathToMdFile[] {
	const bySystemPath = new Map<string, SplitPathToMdFile>();
	for (const path of paths) {
		const key = makeSystemPathForSplitPath(path);
		if (!bySystemPath.has(key)) {
			bySystemPath.set(key, path);
		}
	}
	return [...bySystemPath.values()];
}

function describeReadFailure(reason: VamEffectError): string {
	return `${reason.operation}: ${getErrorMessage(reason.cause)}`;
}

function isMissingAfterReadFailure(
	reason: VamEffectError,
	splitPath: SplitPathToMdFile,
	vam: VamPortDependency,
): Effect.Effect<boolean> {
	if (
		reason._tag === "VamVaultIoError" &&
		classifyReadContentError(getErrorMessage(reason.cause)).kind ===
			ReadContentErrorKind.FileNotFound
	) {
		return Effect.succeed(true);
	}
	// Race-safe fallback: file can vanish between the pre-read exists() and readContent().
	return vam.exists(splitPath).pipe(
		Effect.map((exists) => !exists),
		Effect.catch(() => Effect.succeed(false)),
	);
}
