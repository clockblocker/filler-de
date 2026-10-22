import type {
	SplitPathToFolder,
	SplitPathToMdFile,
	VaultAction,
	VaultPathIdentity,
} from "@textfresser/vault-action-manager";
import {
	splitPathCodec,
	VaultActionKind,
	VaultPath,
} from "@textfresser/vault-action-manager";
import type { SuffixDelimiterConfig } from "../../../types";
import {
	buildCanonicalDelimiter,
	buildFlexibleDelimiterPattern,
} from "../../../utils/delimiter";

export type DelimiterRenameAction = Extract<
	VaultAction,
	{ kind: typeof VaultActionKind.RenameMdFile }
>;

type DelimiterMigrationPlanBase = {
	readonly actions: readonly DelimiterRenameAction[];
	readonly libraryRoot: SplitPathToFolder;
	readonly newConfig: Readonly<SuffixDelimiterConfig>;
	readonly oldConfig: Readonly<SuffixDelimiterConfig>;
	readonly previewCount: number;
};

export type DelimiterMigrationPlan =
	| (DelimiterMigrationPlanBase & { readonly kind: "NoOp" })
	| (DelimiterMigrationPlanBase & { readonly kind: "Ready" });

export type PlanDelimiterMigrationInput = {
	readonly candidates: readonly SplitPathToMdFile[];
	readonly libraryRoot: SplitPathToFolder;
	readonly newConfig: SuffixDelimiterConfig;
	readonly oldConfig: SuffixDelimiterConfig;
};

const ESCAPE_CANDIDATES = ["_", "~", ".", " ", "-", "+", "="] as const;

export function planDelimiterMigration(
	input: PlanDelimiterMigrationInput,
): DelimiterMigrationPlan {
	const oldConfig = freezeConfig(input.oldConfig);
	const newConfig = freezeConfig(input.newConfig);
	const libraryRoot = freezeFolderPath(input.libraryRoot);
	const oldDelimiter = buildCanonicalDelimiter(oldConfig);
	const newDelimiter = buildCanonicalDelimiter(newConfig);

	if (oldDelimiter === newDelimiter) {
		return freezePlan({
			actions: [],
			kind: "NoOp",
			libraryRoot,
			newConfig,
			oldConfig,
			previewCount: 0,
		});
	}

	const oldPattern = buildFlexibleDelimiterPattern(oldConfig);
	const symbolChanged = oldConfig.symbol !== newConfig.symbol;
	const escapeCharacter = findEscapeCharacter(oldConfig, newConfig);
	const futureSymbolPattern = symbolChanged
		? new RegExp(escapeRegex(newConfig.symbol), "g")
		: null;

	const actions = input.candidates
		.filter((candidate) => isInsideRoot(candidate, libraryRoot))
		.flatMap((candidate): DelimiterRenameAction[] => {
			const parts = candidate.basename.split(oldPattern);
			const escapedParts = futureSymbolPattern
				? parts.map((part) =>
						part.replace(futureSymbolPattern, escapeCharacter),
					)
				: parts;
			const nextBasename = escapedParts.join(newDelimiter);
			if (nextBasename === candidate.basename) return [];

			const from = freezeMdPath(candidate);
			const to = freezeMdPath({ ...candidate, basename: nextBasename });
			return [
				Object.freeze({
					kind: VaultActionKind.RenameMdFile,
					// A name taken after planning fails the rename instead of
					// sending the note to an indexed name or the trash.
					payload: Object.freeze({
						from,
						onCollision: "fail" as const,
						to,
					}),
				}),
			];
		})
		.sort((left, right) =>
			splitPathCodec
				.format(left.payload.from)
				.localeCompare(splitPathCodec.format(right.payload.from)),
		);

	return freezePlan({
		actions,
		kind: "Ready",
		libraryRoot,
		newConfig,
		oldConfig,
		previewCount: actions.length,
	});
}

/** A planned rename whose target name another note already holds or also targets. */
export type DelimiterRenameConflict = {
	readonly action: DelimiterRenameAction;
	/** The note at the target now, or the other note the plan renames there. */
	readonly occupiedBy: string;
	readonly reason: "SharedTarget" | "TargetTaken";
};

/**
 * Finds renames that would land on a name already in use, so the plan is
 * refused before anything moves. The renames run with `onCollision: "fail"`,
 * so a name taken only after planning fails its rename instead, and the
 * migration rolls back. `existing` holds every note the plan was built from.
 *
 * Names are compared as the vault's file system compares them (`paths`): on
 * a case-insensitive file system (macOS, Windows) `Foo.md` and `foo.md` are
 * one file. A rename that changes only the case of its own note is not a
 * conflict.
 */
export function findDelimiterRenameConflicts(
	actions: readonly DelimiterRenameAction[],
	existing: readonly SplitPathToMdFile[],
	paths: VaultPathIdentity,
): readonly DelimiterRenameConflict[] {
	const taken = new Map<string, string[]>();
	for (const path of existing) {
		const formatted = splitPathCodec.format(path);
		const key = paths.key(formatted);
		taken.set(key, [...(taken.get(key) ?? []), formatted]);
	}
	const firstClaim = new Map<string, DelimiterRenameAction>();
	const conflicts: DelimiterRenameConflict[] = [];
	for (const action of actions) {
		const source = splitPathCodec.format(action.payload.from);
		const target = paths.key(splitPathCodec.format(action.payload.to));
		const claimant = firstClaim.get(target);
		const occupant = taken
			.get(target)
			?.find(
				(occupied) => !VaultPath.caseSensitive.same(occupied, source),
			);
		if (occupant !== undefined) {
			conflicts.push(
				Object.freeze({
					action,
					occupiedBy: occupant,
					reason: "TargetTaken" as const,
				}),
			);
		} else if (claimant) {
			conflicts.push(
				Object.freeze({
					action,
					occupiedBy: splitPathCodec.format(claimant.payload.from),
					reason: "SharedTarget" as const,
				}),
			);
		}
		if (!claimant) firstClaim.set(target, action);
	}
	return Object.freeze(conflicts);
}

/** Case-sensitive, as the Librarian scopes its Library. */
function isInsideRoot(
	path: SplitPathToMdFile,
	root: SplitPathToFolder,
): boolean {
	return VaultPath.caseSensitive.isUnder(
		splitPathCodec.format(path),
		splitPathCodec.format(root),
		{ inclusive: false },
	);
}

function findEscapeCharacter(
	oldConfig: SuffixDelimiterConfig,
	newConfig: SuffixDelimiterConfig,
): string {
	return (
		ESCAPE_CANDIDATES.find(
			(candidate) =>
				!oldConfig.symbol.includes(candidate) &&
				!newConfig.symbol.includes(candidate),
		) ?? "_"
	);
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function freezeConfig(
	config: SuffixDelimiterConfig,
): Readonly<SuffixDelimiterConfig> {
	return Object.freeze({ ...config });
}

function freezeFolderPath(path: SplitPathToFolder): SplitPathToFolder {
	return Object.freeze({
		...path,
		pathParts: Object.freeze([...path.pathParts]) as unknown as string[],
	});
}

function freezeMdPath(path: SplitPathToMdFile): SplitPathToMdFile {
	return Object.freeze({
		...path,
		pathParts: Object.freeze([...path.pathParts]) as unknown as string[],
	});
}

function freezePlan(plan: DelimiterMigrationPlan): DelimiterMigrationPlan {
	return Object.freeze({
		...plan,
		actions: Object.freeze([...plan.actions]),
	});
}
