/**
 * The reset's vault port over VAM (#65): scans, reads and link resolution,
 * one folder move for the backup, and create-only notes. It offers no
 * delete and no overwrite.
 */
import {
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { getErrorMessage } from "../../utils/get-error-message";
import { ResetFailed, type ResetVault } from "./ports";

type ResetVam = Pick<
	VaultActionManager,
	| "dispatchStopOnFirstFailure"
	| "exists"
	| "list"
	| "protectedPrefixOf"
	| "readContent"
	| "resolveLinkpathDest"
	| "scan"
>;

function folderPath(path: string): SplitPathToFolder | undefined {
	const splitPath = splitPathCodec.parse(path);
	return splitPath.kind === "Folder" ? splitPath : undefined;
}

function mdPath(path: string): SplitPathToMdFile | undefined {
	const splitPath = splitPathCodec.parse(path);
	return splitPath.kind === "MdFile" ? splitPath : undefined;
}

const failed = (message: string) => (cause: unknown) =>
	new ResetFailed({
		cause,
		message: `${message}: ${getErrorMessage(cause)}`,
	});

export function vamResetVault(vam: ResetVam): ResetVault {
	const exists: ResetVault["exists"] = (path) =>
		Effect.suspend(() =>
			vam.exists(splitPathCodec.parse(path)).pipe(
				// A path that cannot be checked counts as taken.
				Effect.orElseSucceed(() => true),
			),
		);
	return {
		createNote: (path, content) =>
			Effect.suspend(() => {
				const splitPath = mdPath(path);
				if (!splitPath)
					return Effect.fail(
						new ResetFailed({
							cause: path,
							message: `${path} is no Markdown path`,
						}),
					);
				// `CreateFile` runs Obsidian's `vault.create`, which refuses
				// an existing file.
				return vam
					.dispatchStopOnFirstFailure([
						{
							kind: VaultActionKind.CreateFile,
							payload: {
								content,
								splitPath: {
									basename: splitPath.basename,
									extension: "md",
									kind: "File",
									pathParts: splitPath.pathParts,
								},
							},
						},
					])
					.pipe(Effect.mapError(failed(`Could not write ${path}`)));
			}),
		exists,
		isProtected: (path) => vam.protectedPrefixOf(path) !== undefined,
		listFolder: (path) =>
			Effect.gen(function* () {
				const folder = folderPath(path);
				if (!folder)
					return yield* new ResetFailed({
						cause: path,
						message: `${path} is no folder path`,
					});
				if (!(yield* exists(path))) return undefined;
				const scan = yield* vam
					.scan(folder)
					.pipe(Effect.mapError(failed(`Could not scan ${path}/`)));
				if (scan.kind === "Partial")
					return yield* new ResetFailed({
						cause: scan.diagnostics,
						message: `Could not read all of ${path}/: ${scan.diagnostics.map((issue) => getErrorMessage(issue)).join("; ")}`,
					});
				const markdown: { path: string; content: string }[] = [];
				const other: string[] = [];
				for (const entry of scan.entries) {
					const entryPath = splitPathCodec.format(entry);
					if (entry.kind !== "MdFile") {
						other.push(entryPath);
						continue;
					}
					const content = yield* entry
						.read()
						.pipe(
							Effect.mapError(
								failed(`Could not read ${entryPath}`),
							),
						);
					markdown.push({ content, path: entryPath });
				}
				return { markdown, other };
			}),
		listRootFolders: Effect.suspend(() =>
			vam.list(splitPathCodec.root).pipe(
				Effect.map((children) =>
					children.flatMap((child) =>
						child.kind === "Folder" ? [child.basename] : [],
					),
				),
				Effect.mapError(failed("Could not list the vault's folders")),
			),
		),
		moveFolder: (from, to) =>
			Effect.suspend(() => {
				const source = folderPath(from);
				const target = folderPath(to);
				if (!source || !target)
					return Effect.fail(
						new ResetFailed({
							cause: [from, to],
							message: `Cannot move ${from}/ to ${to}/`,
						}),
					);
				// Without Obsidian's link updater: with "Automatically update
				// internal links" on, it rewrites links inside the moved notes
				// (`[[Fahren]]` to a `fahren.md` becomes `[[fahren]]`) and in notes
				// elsewhere, so the backup would no longer hold the notes as
				// Collect read them.
				return vam
					.dispatchStopOnFirstFailure([
						{
							kind: VaultActionKind.RenameFolder,
							payload: {
								from: source,
								to: target,
								updateLinks: false,
							},
						},
					])
					.pipe(
						Effect.mapError(
							failed(`Could not move ${from}/ to ${to}/`),
						),
					);
			}),
		read: (path) =>
			Effect.suspend(() => {
				const splitPath = mdPath(path);
				if (!splitPath) return Effect.succeed(undefined);
				return vam.readContent(splitPath).pipe(
					Effect.map((content): string | undefined => content),
					Effect.orElseSucceed(() => undefined),
				);
			}),
		resolveLink: (linkpath, fromPath) =>
			Effect.suspend(() => {
				const from = mdPath(fromPath);
				if (!from) return Effect.succeed(undefined);
				return vam.resolveLinkpathDest(linkpath, from).pipe(
					Effect.map((found) =>
						found ? splitPathCodec.format(found) : undefined,
					),
					Effect.orElseSucceed(() => undefined),
				);
			}),
	};
}
