import { logger } from "../../../../../utils/logger";
import {
	isProcessAction,
	isRenameAction,
	isTrashAction,
	isUpsertMdFileAction,
} from "../../helpers/action-helpers";
import type { Transform, VaultAction } from "../../types/vault-action";
import { sameRename } from "../common/collapse-helpers";
import { makeKeyForAction } from "./helpers/make-key-for-action";

/**
 * Extract transform function from ProcessMdFile payload.
 * Normalizes before/after variant to transform function.
 */
function getTransform(
	payload: { transform: Transform } | { before: string; after: string },
): Transform {
	if ("transform" in payload) {
		return payload.transform;
	}
	return (content: string) => content.replace(payload.before, payload.after);
}

export async function collapseActions(
	actions: readonly VaultAction[],
): Promise<VaultAction[]> {
	// DEBUG: Log incoming actions
	const processActions = actions.filter(isProcessAction);
	if (processActions.length > 0) {
		logger.info("[Collapse] === INPUT ===", {
			processActions: processActions.length,
			processPaths: processActions.map((a) => makeKeyForAction(a)),
			totalActions: actions.length,
		});
	}

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

		// Trash wins - terminal operation
		if (isTrashAction(action)) {
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
				sameRename(existing.payload, action.payload)
			) {
				continue;
			}
			byPath.set(key, action);
			continue;
		}

		// ProcessMdFile rules
		if (isProcessAction(action)) {
			if (existing) {
				if (isUpsertMdFileAction(existing)) {
					// UpsertMdFile + ProcessMdFile
					const upsertContent = existing.payload.content;

					if (upsertContent === null || upsertContent === undefined) {
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
							logger.info(
								"[Collapse] COMPOSING ProcessMdFile in additionalActions",
								{ key },
							);
							// Compose: existing additional then new action
							const existingTransform = getTransform(
								existingAdditional.payload,
							);
							const actionTransform = getTransform(
								action.payload,
							);
							const combined = async (content: string) => {
								const first = await existingTransform(content);
								return await actionTransform(first);
							};
							// Remove old, add composed
							additionalActions.delete(existingAdditional);
							additionalActions.add({
								...existingAdditional,
								payload: {
									splitPath:
										existingAdditional.payload.splitPath,
									transform: combined,
								},
							});
						} else {
							logger.info(
								"[Collapse] Adding ProcessMdFile to additionalActions (first)",
								{ key },
							);
							additionalActions.add(action);
						}
						continue;
					}

					// UpsertMdFile(content) + ProcessMdFile: apply transform to content, keep as Upsert
					const transform = getTransform(action.payload);
					const transformed = await transform(upsertContent);
					byPath.set(key, {
						...existing,
						payload: { ...existing.payload, content: transformed },
					});
					// If any prior additional Process exists for this key, it's now superseded by the merge.
					removeAdditionalProcessByKey(key);
					continue;
				}

				if (isProcessAction(existing)) {
					// Compose transforms: existing then action
					const existingTransform = getTransform(existing.payload);
					const actionTransform = getTransform(action.payload);
					const combined = async (content: string) => {
						const first = await existingTransform(content);
						return await actionTransform(first);
					};
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

					if (upsertContent === null || upsertContent === undefined) {
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

	// DEBUG: Log output
	const outputProcessActions = result.filter(isProcessAction);
	if (outputProcessActions.length > 0) {
		logger.info("[Collapse] === OUTPUT ===", {
			additionalActionsCount: additionalActions.size,
			processActions: outputProcessActions.length,
			processPaths: outputProcessActions.map((a) => makeKeyForAction(a)),
			totalActions: result.length,
		});
	}

	return result;
}
