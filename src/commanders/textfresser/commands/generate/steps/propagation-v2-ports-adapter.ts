import { err, ok, type Result } from "neverthrow";
import type {
	VaultAction,
	VaultActionManager,
} from "../../../../../managers/obsidian/vault-action-manager";
import {
	makeSystemPathForSplitPath,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
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

export type CreatePropagationV2PortsAdapterParams = {
	vam: VamPortDependency;
	lookupInLibraryByCoreName: PathLookupFn;
};

export type PropagationV2PortsAdapter = {
	vault: PropagationVaultPort;
	libraryLookup: PropagationLibraryLookupPort;
};

export function createPropagationV2PortsAdapter(
	params: CreatePropagationV2PortsAdapterParams,
): PropagationV2PortsAdapter {
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

		findCandidateTargets(
			paramsArg: FindCandidateTargetsParams,
		): ReadonlyArray<SplitPathToMdFile> {
			const findByBasenameOptions = paramsArg.folder
				? { folder: paramsArg.folder }
				: undefined;
			const byBasename = vam.findByBasename(
				paramsArg.basename,
				findByBasenameOptions,
			);
			const byCoreName = libraryLookup.findByLeafCoreName(
				paramsArg.basename,
			);

			return dedupeSplitPaths([...byBasename, ...byCoreName]);
		},

		async readManyMdFiles(
			paths: ReadonlyArray<SplitPathToMdFile>,
		): Promise<ReadonlyArray<ReadManyMdFilesOutcome>> {
			const uniquePaths = dedupeSplitPaths(paths);
			return Promise.all(
				uniquePaths.map((splitPath) =>
					readSinglePath({ splitPath, vam }),
				),
			);
		},
		async readNoteOrEmpty(
			splitPath: SplitPathToMdFile,
		): Promise<Result<string, string>> {
			const readOutcome = await readSinglePath({
				splitPath,
				vam,
			});
			if (readOutcome.kind === "Found") {
				return ok(readOutcome.content);
			}
			if (readOutcome.kind === "Missing") {
				return ok("");
			}
			return err(readOutcome.reason);
		},
	};
}

async function readSinglePath(params: {
	splitPath: SplitPathToMdFile;
	vam: VamPortDependency;
}): Promise<ReadManyMdFilesOutcome> {
	const { splitPath, vam } = params;

	if (!vam.exists(splitPath)) {
		return {
			kind: "Missing",
			splitPath,
		};
	}

	const readResult = await vam.readContent(splitPath);
	if (readResult.isOk()) {
		return {
			content: readResult.value,
			kind: "Found",
			splitPath,
		};
	}

	if (isMissingAfterReadFailure(readResult.error, splitPath, vam)) {
		return {
			kind: "Missing",
			splitPath,
		};
	}

	return {
		kind: "Error",
		reason: readResult.error,
		splitPath,
	};
}

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

function isFileNotFoundReadError(reason: string): boolean {
	const normalized = reason.trim().toLowerCase();
	return normalized.includes("file not found");
}

function isMissingAfterReadFailure(
	reason: string,
	splitPath: SplitPathToMdFile,
	vam: VamPortDependency,
): boolean {
	if (isFileNotFoundReadError(reason)) return true;
	// Race-safe fallback: file can vanish between the pre-read exists() and readContent().
	return !vam.exists(splitPath);
}
