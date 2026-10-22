import { Effect, Schema } from "effect";
import {
	VamContentConflictError,
	type VamVaultIoError,
} from "../effect/errors";
import type { VaultIo } from "../effect/ports";
import { pathfinder } from "../helpers/pathfinder";
import { getErrorMessage } from "../internal/get-error-message";
import type { SplitPathToMdFile } from "../types/split-path";
import {
	type ActiveEditorSnapshot,
	activeEditorFailure,
} from "./active-view/active-editor-snapshot";
import type { ActiveFileService } from "./active-view/active-file-service";

/**
 * Where a Markdown file's content is read and written:
 *
 * - `Editor`: through one view's editor, unsaved typing included. The
 *   active view when it shows the file, as before; otherwise a background
 *   view whose buffer differs from the file on disk.
 * - `Disk`: through the vault. No view shows the file, or every view
 *   holds what the disk holds. `content` is the disk content when the
 *   route read it to decide, so a read need not read it again.
 */
export type ContentRoute =
	| { readonly _tag: "Editor"; readonly snapshot: ActiveEditorSnapshot }
	| { readonly _tag: "Disk"; readonly content: string | null };

/**
 * The open views of one file hold different content, so VAM cannot tell
 * which one is current. Kept as the `cause` of the `VamContentConflictError`
 * a read or write fails with; nothing was read or written.
 */
export class OpenViewsDisagree extends Schema.TaggedError<OpenViewsDisagree>()(
	"OpenViewsDisagree",
	{ views: Schema.Number },
) {
	override get message(): string {
		return `${this.views} open views of the file hold different content; nothing was read or written`;
	}
}

/**
 * Decides the content route of `target` from every Markdown view showing
 * it. With no view but the active one, this is the route VAM always took.
 * Otherwise the views must agree: the active view's buffer, if it shows
 * the file, or else the disk, which `readDisk` reads, is compared with
 * every other view's buffer. Views that disagree fail it with
 * `VamContentConflictError`.
 */
export const resolveContentRoute = Effect.fn("vam.markdown.route")(function* (
	editors: ActiveFileService,
	target: SplitPathToMdFile,
	readDisk: Effect.Effect<string, VamVaultIoError, VaultIo>,
) {
	const path = pathfinder.systemPathFromSplitPath(target);
	const active = yield* editors.observeTarget(target);
	const views = yield* editors.observeViews(target);
	const others = views.filter((view) => view.editor !== active?.editor);
	yield* Effect.annotateCurrentSpan({
		active: active !== null,
		path,
		views: views.length,
	});
	const [first] = others;
	if (!first) return active ? editorRoute(active) : diskRoute(null);

	const buffers = yield* Effect.forEach(others, readBuffer);
	if (active) {
		const own = yield* readBuffer(active);
		if (buffers.every((buffer) => buffer === own))
			return editorRoute(active);
		return yield* disagree(path, new Set([own, ...buffers]).size);
	}

	const distinct = new Set(buffers);
	if (distinct.size > 1) return yield* disagree(path, distinct.size);
	const disk = yield* readDisk;
	// One write through one view: Obsidian keeps a file's views in step.
	return buffers[0] === disk ? diskRoute(disk) : editorRoute(first);
});

function editorRoute(snapshot: ActiveEditorSnapshot): ContentRoute {
	return { _tag: "Editor", snapshot };
}

function diskRoute(content: string | null): ContentRoute {
	return { _tag: "Disk", content };
}

function readBuffer(view: ActiveEditorSnapshot) {
	return Effect.try({
		catch: (cause) =>
			activeEditorFailure(
				"ReadFailure",
				"readViewBuffer",
				getErrorMessage(cause),
				view.path,
				cause,
			),
		try: () => view.editor.getValue() ?? "",
	});
}

function disagree(path: string, views: number) {
	return new VamContentConflictError({
		cause: new OpenViewsDisagree({ views }),
		operation: "openViews.agree",
		path,
	});
}
