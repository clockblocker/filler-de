import type { Result } from "neverthrow";
import { ok } from "neverthrow";
import type { VaultActionManager } from "../../../../../managers/obsidian/vault-action-manager";
import type {
	SplitPath,
	SplitPathToFolder,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../../../types/schemas/node-name";

/**
 * Extracts duplicate marker (e.g., " 1", " 2") from end of string.
 * Returns the clean string and the marker (or empty string if none).
 */
export const extractDuplicateMarker = (
	name: string,
): { cleanName: string; marker: string; number: number | null } => {
	const match = name.match(/^(.+?)( (\d+))$/);
	if (match && match[1] && match[2] && match[3]) {
		return {
			cleanName: match[1],
			marker: match[2],
			number: Number.parseInt(match[3], 10),
		};
	}
	return { cleanName: name, marker: "", number: null };
};

/**
 * Builds a name with a duplicate marker.
 */
export const buildNameWithDuplicateMarker = (
	cleanName: string,
	number: number,
): string => {
	return `${cleanName} ${number}`;
};

/**
 * Given a target coreName and folder, finds the next available duplicate number.
 * Checks existing files in the folder to avoid conflicts.
 *
 * @param targetCoreName - The desired coreName (e.g., "Note 1" from duplicate)
 * @param folderPath - The folder to check for existing files
 * @param suffixParts - The suffix parts to append to the coreName
 * @param extension - The file extension (including dot, e.g., ".md")
 * @param suffixDelimiter - The delimiter used in suffixes
 * @param vaultActionManager - Manager to list files
 * @returns The coreName to use (may have incremented duplicate number)
 */
export async function resolveUniqueDuplicateName(
	targetCoreName: NodeName,
	folderPath: SplitPathToFolder,
	suffixParts: NodeName[],
	extension: string,
	suffixDelimiter: string,
	vaultActionManager: VaultActionManager,
): Promise<Result<NodeName, string>> {
	// Extract duplicate marker from target coreName
	const { cleanName, number } = extractDuplicateMarker(targetCoreName);

	// If no duplicate marker, just return as-is
	if (number === null) {
		return ok(targetCoreName);
	}

	// List files in the folder
	const filesResult = await vaultActionManager.list(folderPath);
	if (filesResult.isErr()) {
		// If we can't list, just use the target name
		return ok(targetCoreName);
	}

	const existingFiles = filesResult.value;

	// Find existing duplicate numbers by matching basename pattern
	const existingNumbers = new Set<number>();

	// Build regex pattern for matching: "<cleanName> <N><suffix><extension>"
	const suffixStr =
		suffixParts.length > 0
			? suffixDelimiter + suffixParts.join(suffixDelimiter)
			: "";
	const basenamePattern = new RegExp(
		`^${escapeRegex(cleanName)} (\\d+)${escapeRegex(suffixStr)}$`,
	);

	for (const file of existingFiles) {
		if (!isFileSplitPath(file)) continue;
		if (file.extension !== extension) continue;

		const match = file.basename.match(basenamePattern);
		if (match && match[1]) {
			existingNumbers.add(Number.parseInt(match[1], 10));
		}
	}

	// Find the next available number starting from the target
	let nextNumber = number;
	while (existingNumbers.has(nextNumber)) {
		nextNumber++;
	}

	// Build the final coreName
	const finalCoreName = buildNameWithDuplicateMarker(
		cleanName,
		nextNumber,
	) as NodeName;

	return ok(finalCoreName);
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isFileSplitPath(
	sp: SplitPath,
): sp is SplitPath & { basename: string; extension: string } {
	return sp.type === "File" || sp.type === "MdFile";
}
