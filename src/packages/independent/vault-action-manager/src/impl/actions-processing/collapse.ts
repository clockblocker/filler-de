import { Effect } from "effect";
import {
	isProcessAction,
	isRenameAction,
	isTrashAction,
	isUpsertMdFileAction,
	processTransformOf,
} from "../../helpers/action-helpers";
import {
	type Transform,
	type VaultAction,
	VaultActionKind,
} from "../../types/vault-action";
import { sameRename } from "../common/collapse-helpers";
import { makeKeyForAction } from "./helpers/make-key-for-action";

/** Whether a trash runs only while its file holds some content. */
function isGuardedTrash(action: VaultAction): boolean {
	return (
		action.kind === VaultActionKind.TrashMdFile &&
		action.payload.ifContent !== undefined
	);
}

/** The collision policy a rename runs with, its default spelled out. */
function collisionOf(action: VaultAction): string | undefined {
	switch (action.kind) {
		case VaultActionKind.RenameMdFile:
			return action.payload.onCollision ?? "dedupe";
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameFolder:
			return action.payload.onCollision ?? "index";
		default:
			return undefined;
	}
}

/** A transform applied to known content, as collapse folds it into a create. */
const transformContent = (transform: Transform, content: string) =>
	Effect.tryPromise({
		catch: (cause) => cause,
		try: () => Promise.resolve(transform(content)),
	});

/**
 * Composes two transforms in order. The result stays synchronous when both
 * parts are, so background execution can apply it atomically.
 */
function composeTransforms(first: Transform, second: Transform): Transform {
	return (content) => {
		const intermediate = first(content);
		return typeof intermediate === "string"
			? second(intermediate)
			: intermediate.then(second);
	};
}

export const collapseActions = Effect.fn("DispatchBatch.collapseActions")(
	function* (actions: readonly VaultAction[]) {
		const byPath = new Map<string, VaultAction>();

		// Track actions that must be kept even when they share a key with another action
		// (e.g., UpsertMdFile(null) + ProcessMdFile where both are needed).
		//
		// NOTE: We keep this as Set<VaultAction> but we must never delete from it while iterating.
		const additionalActions = new Set<VaultAction>();

		// Helper: remove ALL additional Process actions that belong to the same key.
		const removeAdditionalProcessByKey = (key: string) => {
			const toDelete: VaultAction[] = [];
			for (const a of additionalActions) {
				if (isProcessAction(a) && makeKeyForAction(a) === key) {
					toDelete.push(a);
				}
			}
			for (const a of toDelete) additionalActions.delete(a);
		};

		// Helper: find existing Process action in additionalActions for a key
		const findAdditionalProcessByKey = (
			key: string,
		): VaultAction | undefined => {
			for (const a of additionalActions) {
				if (isProcessAction(a) && makeKeyForAction(a) === key) {
					return a;
				}
			}
			return undefined;
		};

		for (const action of actions) {
			const key = makeKeyForAction(action);
			const existing = byPath.get(key);

			// Trash wins - terminal operation. An unconditional trash already
			// there stays: it trashes in every case a guarded one would.
			if (isTrashAction(action)) {
				if (
					existing &&
					isTrashAction(existing) &&
					!isGuardedTrash(existing) &&
					isGuardedTrash(action)
				)
					continue;
				byPath.set(key, action);
				// If we trash the target, any additional Process for the same key is meaningless.
				removeAdditionalProcessByKey(key);
				continue;
			}

			// If existing is trash, skip (trash already won)
			if (existing && isTrashAction(existing)) {
				continue;
			}

			// Rename rules: drop exact duplicates (same from->to); otherwise latest wins.
			if (isRenameAction(action)) {
				if (
					existing &&
					isRenameAction(existing) &&
					sameRename(existing.payload, action.payload) &&
					collisionOf(existing) === collisionOf(action)
				) {
					continue;
				}
				byPath.set(key, action);
				continue;
			}

			// ProcessMdFile rules
			if (isProcessAction(action)) {
				if (existing) {
					if (existing.kind === VaultActionKind.CreateMdFile) {
						// CreateMdFile + ProcessMdFile: create the transformed content
						const transformed = yield* transformContent(
							processTransformOf(action.payload),
							existing.payload.content ?? "",
						);
						byPath.set(key, {
							...existing,
							payload: {
								...existing.payload,
								content: transformed,
							},
						});
						continue;
					}

					if (isUpsertMdFileAction(existing)) {
						// UpsertMdFile + ProcessMdFile
						const upsertContent = existing.payload.content;

						if (
							upsertContent === null ||
							upsertContent === undefined
						) {
							// EnsureExist + ProcessMdFile: keep both
							// Keep UpsertMdFile in map; compose Process in additionalActions.
							byPath.set(key, existing);

							// Check if there's already a Process in additionalActions for this key
							const existingAdditional =
								findAdditionalProcessByKey(key);
							if (
								existingAdditional &&
								isProcessAction(existingAdditional)
							) {
								// Compose: existing additional then new action
								const existingTransform = processTransformOf(
									existingAdditional.payload,
								);
								const actionTransform = processTransformOf(
									action.payload,
								);
								const combined = composeTransforms(
									existingTransform,
									actionTransform,
								);
								// Remove old, add composed
								additionalActions.delete(existingAdditional);
								additionalActions.add({
									...existingAdditional,
									payload: {
										splitPath:
											existingAdditional.payload
												.splitPath,
										transform: combined,
									},
								});
							} else {
								additionalActions.add(action);
							}
							continue;
						}

						// UpsertMdFile(content) + ProcessMdFile: apply transform to content, keep as Upsert
						const transformed = yield* transformContent(
							processTransformOf(action.payload),
							upsertContent,
						);
						byPath.set(key, {
							...existing,
							payload: {
								...existing.payload,
								content: transformed,
							},
						});
						// If any prior additional Process exists for this key, it's now superseded by the merge.
						removeAdditionalProcessByKey(key);
						continue;
					}

					if (isProcessAction(existing)) {
						// Compose transforms: existing then action
						const existingTransform = processTransformOf(
							existing.payload,
						);
						const actionTransform = processTransformOf(
							action.payload,
						);
						const combined = composeTransforms(
							existingTransform,
							actionTransform,
						);
						byPath.set(key, {
							...existing,
							payload: {
								splitPath: existing.payload.splitPath,
								transform: combined,
							},
						});
						continue;
					}
				}

				byPath.set(key, action);
				continue;
			}

			// UpsertMdFile rules
			if (isUpsertMdFileAction(action)) {
				if (existing) {
					// CreateMdFile + EnsureExist: the create makes it exist
					if (
						existing.kind === VaultActionKind.CreateMdFile &&
						(action.payload.content === null ||
							action.payload.content === undefined)
					) {
						continue;
					}

					if (isUpsertMdFileAction(existing)) {
						// Both UpsertMdFile - collapse based on content semantics
						const aContent = action.payload.content;
						const eContent = existing.payload.content;

						if (aContent === null || aContent === undefined) {
							// Action is EnsureExist; existing is "stronger" (contentful) or also EnsureExist -> keep existing
							continue;
						}

						if (eContent === null || eContent === undefined) {
							// Existing is EnsureExist, action has content -> replace with action
							removeAdditionalProcessByKey(key);
							byPath.set(key, action);
							continue;
						}

						// Both have content -> latest wins
						removeAdditionalProcessByKey(key);
						byPath.set(key, action);
						continue;
					}

					if (isProcessAction(existing)) {
						// ProcessMdFile + UpsertMdFile
						const upsertContent = action.payload.content;

						if (
							upsertContent === null ||
							upsertContent === undefined
						) {
							// Process + EnsureExist: keep both (EnsureExist first, process second)
							byPath.set(key, action); // keep EnsureExist in map
							additionalActions.add(existing); // keep Process as additional
							continue;
						}

						// Process + Upsert(content): write wins, discard process
						removeAdditionalProcessByKey(key);
						byPath.set(key, action);
						continue;
					}
				}

				byPath.set(key, action);
				continue;
			}

			// Default: newest wins for all other action types
			byPath.set(key, action);
		}

		// Combine actions from map + additional actions
		const result = [...byPath.values(), ...additionalActions];

		return result;
	},
);
