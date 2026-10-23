/**
 * The one write resolution makes to a Scroll: a compare-and-swap transform
 * through VAM. VAM runs it on the editor's content when the Scroll is open
 * and through `Vault.process` otherwise; either way the transform sees the
 * content as it is at that moment, so the user's typing is never replaced.
 */
import {
	isContentConflict,
	SplitPathKind,
	splitPathCodec,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Data, Effect } from "effect";
import type { UnlinkObserver, UnlinkScrolls } from "./unlink-observer";

export class ScrollWriteFailed extends Data.TaggedError("ScrollWriteFailed")<{
	readonly cause: unknown;
	/** Another write won the race; the transform may run again. */
	readonly conflict: boolean;
	readonly message: string;
}> {}

export type ScrollFiles = {
	readonly process: (
		scrollPath: string,
		transform: (current: string) => string,
	) => Effect.Effect<void, ScrollWriteFailed>;
};

export function vamScrollFiles(
	vam: Pick<VaultActionManager, "dispatchStopOnFirstFailure">,
): ScrollFiles {
	return {
		process: (scrollPath, transform) =>
			Effect.suspend(() => {
				const splitPath = splitPathCodec.parse(scrollPath);
				if (splitPath.kind !== "MdFile")
					return Effect.fail(
						new ScrollWriteFailed({
							cause: scrollPath,
							conflict: false,
							message: `${scrollPath} is no Markdown file`,
						}),
					);
				return vam
					.dispatchStopOnFirstFailure(
						[
							{
								kind: VaultActionKind.ProcessMdFile,
								payload: { splitPath, transform },
							},
						],
						{ caller: "classify" },
					)
					.pipe(
						Effect.mapError(
							(error) =>
								new ScrollWriteFailed({
									cause: error,
									conflict: isContentConflict(error),
									message: `Could not write the links into ${scrollPath}`,
								}),
						),
					);
			}),
	};
}

/** A Markdown note's split path, or none for another path. */
function mdSplitPath(path: string) {
	const splitPath = splitPathCodec.parse(path);
	return splitPath.kind === SplitPathKind.MdFile ? splitPath : undefined;
}

/** What the unlink observer reads through VAM. A read that fails reads as no Scroll. */
export function vamUnlinkScrolls(
	vam: Pick<
		VaultActionManager,
		"readContent" | "readStat" | "resolveLinkpathDest"
	>,
): UnlinkScrolls {
	return {
		modifiedAt: (path) => {
			const splitPath = mdSplitPath(path);
			return splitPath === undefined
				? Effect.succeed(undefined)
				: vam.readStat(splitPath).pipe(
						Effect.map(({ mtime }) => mtime),
						Effect.orElseSucceed(() => undefined),
					);
		},
		read: (path) => {
			const splitPath = mdSplitPath(path);
			return splitPath === undefined
				? Effect.succeed(undefined)
				: vam
						.readContent(splitPath)
						.pipe(Effect.orElseSucceed(() => undefined));
		},
		resolve: (linkpath, sourcePath) => {
			const from = mdSplitPath(sourcePath);
			return from === undefined
				? Effect.succeed(undefined)
				: vam.resolveLinkpathDest(linkpath, from).pipe(
						Effect.map((found) =>
							found === null
								? undefined
								: splitPathCodec.format(found),
						),
						Effect.orElseSucceed(() => undefined),
					);
		},
	};
}

/**
 * Tells the observer of every Markdown file VAM saw modified, anywhere in
 * the vault; it answers how to stop.
 */
export function observeScrollModifications(
	vam: Pick<VaultActionManager, "subscribeToMdModifications">,
	observer: Pick<UnlinkObserver, "modified">,
) {
	return vam
		.subscribeToMdModifications(splitPathCodec.root, (event) =>
			observer.modified(
				event.modifications.map(({ splitPath }) =>
					splitPathCodec.format(splitPath),
				),
			),
		)
		.pipe(Effect.map((subscription) => Effect.ignore(subscription.close)));
}
