import type {
	SplitPathToFolder,
	SplitPathToMdFile,
	VaultAction,
} from "@textfresser/vault-action-manager";
import {
	splitPathCodec,
	VaultActionKind,
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
					payload: Object.freeze({ from, to }),
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

function isInsideRoot(
	path: SplitPathToMdFile,
	root: SplitPathToFolder,
): boolean {
	const rootParts = [...root.pathParts, root.basename].filter(Boolean);
	return rootParts.every((part, index) => path.pathParts[index] === part);
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
