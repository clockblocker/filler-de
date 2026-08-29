import { Effect } from "effect";
import { TFile } from "obsidian";
import { VamVaultIoError } from "../../../effect/errors";
import { ActiveEditorAccess, VaultIo } from "../../../effect/ports";
import { errorNoTFileFound } from "../../../errors";
import { pathfinder } from "../../../helpers/pathfinder";
import type { SplitPathToAnyFile } from "../../../types/split-path";
import { annotateFileAccessFailure } from "../tracing";

export const cd = Effect.fn("vam.activeEditor.open")(function* (
	file: TFile | SplitPathToAnyFile,
) {
	const systemPath = isTFile(file)
		? file.path
		: pathfinder.systemPathFromSplitPath(file);
	yield* Effect.annotateCurrentSpan({ operation: "open", path: systemPath });
	let tfile: TFile;
	if (isTFile(file)) {
		tfile = file;
	} else {
		const vault = yield* VaultIo;
		const abstractFile = yield* vault.getAbstractFileByPath(systemPath);
		tfile =
			abstractFile instanceof TFile
				? abstractFile
				: yield* new VamVaultIoError({
						cause: new Error(errorNoTFileFound(systemPath)),
						operation: "resolveFileToOpen",
						path: systemPath,
					});
	}

	const activeEditor = yield* ActiveEditorAccess;
	yield* activeEditor.openFile(tfile);
	return tfile;
}, Effect.tapError(annotateFileAccessFailure));

function isTFile(file: TFile | SplitPathToAnyFile): file is TFile {
	return "vault" in file && "stat" in file;
}
