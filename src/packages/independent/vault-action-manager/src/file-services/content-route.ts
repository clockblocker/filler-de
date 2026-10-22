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
 *   active view when it shows the file in source mode, as before;
 *   otherwise a view holding unsaved content, whose buffer is `content`.
 * - `Disk`: through the vault. No view shows the file, or none holds
 *   unsaved content. `content` is the disk content when the route read it
 *   to decide, so a read need not read it again.
 */
export type ContentRoute =
	| {
			readonly _tag: "Editor";
			readonly snapshot: ActiveEditorSnapshot;
			/** The background view's buffer; `null` on the active route. */
			readonly content: string | null;
	  }
	| { readonly _tag: "Disk"; readonly content: string | null };

/**
 * The background views of one file hold different unsaved content, so VAM
 * cannot tell which one is current. Kept as the `cause` of the
 * `VamContentConflictError` a read or write fails with; nothing was read
 * or written.
 */
export class OpenViewsDisagree extends Schema.TaggedError<OpenViewsDisagree>()(
	"OpenViewsDisagree",
	{ views: Schema.Number },
) {
	override get message(): string {
		return `${this.views} open views of the file hold different unsaved content; nothing was read or written`;
	}
}

type ViewState = {
	readonly snapshot: ActiveEditorSnapshot;
	readonly buffer: string;
	/**
	 * `Loading`: the view holds no content yet. `Clean`: it holds what it
	 * last loaded or saved, which may be older than the disk until Obsidian
	 * reloads it. `Unknown`: only the disk can tell.
	 */
	readonly state: "Clean" | "Loading" | "Unknown";
};

/**
 * Decides the content route of `target`. The active view, when it shows
 * the file in source mode, is the route, as it always was: typing goes
 * into the active view, and Obsidian copies it into the file's other views
 * within a few milliseconds, so they can only lag it. In reading mode
 * nothing can be typed into the active view, and its editor lags what it
 * shows, so it is consulted like every other view of the file. A view
 * that holds what it last loaded or saved is clean even while it is older
 * than the disk (Obsidian reloads it after a write); any other view holds
 * unsaved content when its buffer differs from the disk, which `readDisk`
 * reads. Views with different unsaved content fail it with
 * `VamContentConflictError`.
 *
 * Untraced: every content read takes it; callers annotate their own span.
 */
export const resolveContentRoute = Effect.fnUntraced(function* (
	editors: ActiveFileService,
	target: SplitPathToMdFile,
	readDisk: Effect.Effect<string, VamVaultIoError, VaultIo>,
) {
	const active = yield* editors.observeTarget(target);
	if (active?.mode === "source") return editorRoute(active, null);

	// Every view of the file, the active one in reading mode included.
	const views = yield* editors.observeViews(target);
	if (views.length === 0) return diskRoute(null);
	const states = yield* Effect.forEach(views, readView);
	const undecided = states.filter((view) => view.state === "Unknown");
	yield* Effect.annotateCurrentSpan({
		openViews: views.length,
		undecidedViews: undecided.length,
	});
	if (undecided.length === 0) return diskRoute(null);

	const disk = yield* readDisk;
	const unsaved = undecided.filter((view) => view.buffer !== disk);
	const [first] = unsaved;
	if (!first) return diskRoute(disk);
	const distinct = new Set(unsaved.map((view) => view.buffer)).size;
	if (distinct > 1)
		return yield* new VamContentConflictError({
			cause: new OpenViewsDisagree({ views: distinct }),
			operation: "openViews.agree",
			path: pathfinder.systemPathFromSplitPath(target),
		});
	// One write through one view: Obsidian keeps a file's views in step.
	// Only a source-mode view can take it; through a reading-mode one it
	// fails with `WrongMode`, writing nothing.
	const writable =
		unsaved.find((view) => view.snapshot.mode === "source") ?? first;
	return editorRoute(writable.snapshot, first.buffer);
});

function editorRoute(
	snapshot: ActiveEditorSnapshot,
	content: string | null,
): ContentRoute {
	return { _tag: "Editor", content, snapshot };
}

function diskRoute(content: string | null): ContentRoute {
	return { _tag: "Disk", content };
}

function readView(snapshot: ActiveEditorSnapshot) {
	return Effect.try({
		catch: (cause) =>
			activeEditorFailure(
				"ReadFailure",
				"readViewBuffer",
				getErrorMessage(cause),
				snapshot.path,
				cause,
			),
		try: (): ViewState => {
			const buffer =
				snapshot.viewData?.() ?? snapshot.editor.getValue() ?? "";
			const persisted = snapshot.persisted?.();
			if (persisted === undefined)
				return { buffer, snapshot, state: "Unknown" };
			if (persisted.data === null)
				return { buffer, snapshot, state: "Loading" };
			if (!persisted.saving && persisted.data === buffer)
				return { buffer, snapshot, state: "Clean" };
			return { buffer, snapshot, state: "Unknown" };
		},
	});
}
