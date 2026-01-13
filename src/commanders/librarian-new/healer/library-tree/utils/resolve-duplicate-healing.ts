import { getParsedUserSettings } from "../../../../../global-state/global-state";
import type { VaultActionManager } from "../../../../../managers/obsidian/vault-action-manager";
import type { SplitPathToFolder } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { SplitPathKind } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../../types/schemas/node-name";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../codecs";
import type { HealingAction } from "../types/healing-action";
import {
	extractDuplicateMarker,
	resolveUniqueDuplicateName,
} from "./duplicate-name-resolver";

/**
 * Resolves duplicate conflicts in healing actions.
 * For file renames with duplicate markers (e.g., "Note 1"), checks if the target
 * already exists and increments the number if needed.
 */
export async function resolveDuplicateHealingActions(
	actions: HealingAction[],
	vaultActionManager: VaultActionManager,
): Promise<HealingAction[]> {
	const settings = getParsedUserSettings();
	const resolved: HealingAction[] = [];

	for (const action of actions) {
		if (action.kind === "RenameFile" || action.kind === "RenameMdFile") {
			const resolvedAction = await resolveFileRenameAction(
				action,
				settings.suffixDelimiter,
				vaultActionManager,
			);
			resolved.push(resolvedAction);
		} else {
			resolved.push(action);
		}
	}

	return resolved;
}

async function resolveFileRenameAction(
	action: HealingAction & { kind: "RenameFile" | "RenameMdFile" },
	suffixDelimiter: string,
	vaultActionManager: VaultActionManager,
): Promise<HealingAction> {
	const { to } = action.payload;

	// Parse the target basename to extract coreName and suffix
	const parts = to.basename.split(suffixDelimiter);
	const [coreName, ...suffixParts] = parts;

	if (!coreName) return action;

	// Check if coreName has a duplicate marker
	const { number } = extractDuplicateMarker(coreName);
	if (number === null) {
		// No duplicate marker, no need to resolve
		return action;
	}

	// Build folder path from pathParts
	const folderPath: SplitPathToFolder = {
		basename: to.pathParts[to.pathParts.length - 1] ?? "",
		kind: SplitPathKind.Folder,
		pathParts: to.pathParts.slice(0, -1),
	};

	// Resolve unique name
	const extension = to.kind === SplitPathKind.MdFile ? "md" : to.extension;
	const resolvedCoreNameResult = await resolveUniqueDuplicateName(
		coreName as NodeName,
		folderPath,
		suffixParts as NodeName[],
		extension,
		suffixDelimiter,
		vaultActionManager,
	);

	if (resolvedCoreNameResult.isErr()) {
		return action;
	}

	const resolvedCoreName = resolvedCoreNameResult.value;

	// If name didn't change, return original action
	if (resolvedCoreName === coreName) {
		return action;
	}

	// Create codecs
	const settings = getParsedUserSettings();
	const rules = makeCodecRulesFromSettings(settings);
	const codecs = makeCodecs(rules);

	// Build new basename with resolved coreName
	const newBasename = codecs.suffix.serializeSeparatedSuffix({
		coreName: resolvedCoreName,
		suffixParts: suffixParts as NodeName[],
	});

	// Return updated action
	if (action.kind === "RenameMdFile") {
		return {
			...action,
			payload: {
				...action.payload,
				to: {
					...to,
					basename: newBasename,
				},
			},
		};
	}

	return {
		...action,
		payload: {
			...action.payload,
			to: {
				...to,
				basename: newBasename,
			},
		},
	};
}
