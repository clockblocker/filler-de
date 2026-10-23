/**
 * Obsidian's workspace navigation, as a service. Reading the active leaf
 * and editor stays VAM's (`ActiveEditorAccess`).
 */
import { Context, Data, Effect, Layer } from "effect";
import type { App, PaneType } from "obsidian";
import { getErrorMessage } from "../../../utils/get-error-message";

/** Obsidian could not open a link. */
export class WorkspaceError extends Data.TaggedError("WorkspaceError")<{
	readonly operation: "openLink";
	readonly target: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

/** The part of Obsidian's workspace the service opens links through. */
export type WorkspaceNavigation = Pick<App["workspace"], "openLinkText">;

export class Workspace extends Context.Service<
	Workspace,
	{
		/**
		 * Opens `target`, a link text such as a path, as a link in
		 * `sourcePath` resolves it; in a new tab when `newLeaf` is true.
		 */
		readonly openLink: (
			target: string,
			sourcePath: string,
			newLeaf?: PaneType | boolean,
		) => Effect.Effect<void, WorkspaceError>;
	}
>()("textfresser/managers/obsidian/host/Workspace") {
	static readonly over = (workspace: WorkspaceNavigation) =>
		Workspace.of({
			openLink: Effect.fn("Workspace.openLink")(
				(
					target: string,
					sourcePath: string,
					newLeaf?: PaneType | boolean,
				) =>
					Effect.tryPromise({
						catch: (cause) =>
							new WorkspaceError({
								cause,
								message: `could not open ${target}: ${getErrorMessage(cause)}`,
								operation: "openLink",
								target,
							}),
						try: () =>
							workspace.openLinkText(target, sourcePath, newLeaf),
					}),
			),
		});

	static readonly layer = (workspace: WorkspaceNavigation) =>
		Layer.succeed(Workspace, Workspace.over(workspace));
}
