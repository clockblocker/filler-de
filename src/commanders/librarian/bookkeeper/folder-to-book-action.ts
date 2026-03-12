import { Notice } from "obsidian";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import { MD } from "../../../managers/obsidian/vault-action-manager/types/literals";
import {
	type AnySplitPath,
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import { logger } from "../../../utils/logger";
import type { CodecRules, Codecs } from "../codecs";
import type { RenameScrollNodeAction } from "../healer/library-tree/tree-action/types/tree-action";
import { TreeActionType } from "../healer/library-tree/tree-action/types/tree-action";
import { TreeNodeKind } from "../healer/library-tree/tree-node/types/atoms";
import {
	buildExistingPageTransform,
	buildSectionChainFromPathParts,
} from "./build-actions";
import { buildPageBasename } from "./page-codec";
import { PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";

const LEADING_NUMBER_PATTERN = /^(\d+)/;

type FolderToBookPlan = {
	currentPath: SplitPathToMdFile;
	finalPath: SplitPathToMdFile;
	newNodeName: string;
	pageIndex: number;
	tempPath: SplitPathToMdFile | null;
};

export type FolderToBookContext = {
	codecs: Codecs;
	folderPath: SplitPathToFolder;
	rules: CodecRules;
	vam: VaultActionManager;
};

export type FolderToBookResult = {
	pageCount: number;
	treeActions: RenameScrollNodeAction[];
};

export function canConvertFolderToBook(
	folderPath: SplitPathToFolder,
	children: readonly AnySplitPath[],
	rules: CodecRules,
): boolean {
	if (!isFolderInsideLibrary(folderPath, rules)) {
		return false;
	}

	if (children.some((child) => child.kind === SplitPathKind.Folder)) {
		return false;
	}

	return children.some((child) => child.kind === SplitPathKind.MdFile);
}

export function sortBookSourceFiles(
	files: readonly SplitPathToMdFile[],
): SplitPathToMdFile[] {
	const numberedFiles = files.map((file) => ({
		file,
		leadingNumber: readLeadingNumber(file.basename),
	}));

	const hasStableNumericOrder =
		numberedFiles.every((entry) => entry.leadingNumber !== null) &&
		new Set(numberedFiles.map((entry) => String(entry.leadingNumber)))
			.size === numberedFiles.length;

	return [...numberedFiles]
		.sort((left, right) => {
			if (
				hasStableNumericOrder &&
				left.leadingNumber !== null &&
				right.leadingNumber !== null
			) {
				return (
					left.leadingNumber - right.leadingNumber ||
					left.file.basename.localeCompare(right.file.basename)
				);
			}

			return left.file.basename.localeCompare(right.file.basename);
		})
		.map((entry) => entry.file);
}

export async function folderToBookAction(
	context: FolderToBookContext,
): Promise<FolderToBookResult | null> {
	const { codecs, folderPath, rules, vam } = context;

	const listResult = vam.list(folderPath);
	if (listResult.isErr()) {
		logger.warn(
			"[folderToBookAction] Failed to list folder:",
			folderPath,
			listResult.error,
		);
		new Notice("Failed to read folder contents");
		return null;
	}

	const children = listResult.value;
	if (!canConvertFolderToBook(folderPath, children, rules)) {
		new Notice("Folder can't be converted into a book");
		return null;
	}

	const sourceFiles = sortBookSourceFiles(
		children.filter(
			(child): child is SplitPathToMdFile =>
				child.kind === SplitPathKind.MdFile,
		),
	);
	if (sourceFiles.length === 0) {
		new Notice("Folder has no markdown files to convert");
		return null;
	}

	const folderPathWithRoot = [...folderPath.pathParts, folderPath.basename];
	const suffixParts =
		codecs.suffix.pathPartsWithRootToSuffixParts(folderPathWithRoot);
	const plans = buildPlans(sourceFiles, folderPath, suffixParts, rules);

	const needsTempPhase = hasRenameCollision(plans);
	if (needsTempPhase) {
		const tempRenameResult = await vam.dispatch(
			buildTempRenameActions(plans, suffixParts, rules),
		);
		if (tempRenameResult.isErr()) {
			logger.warn(
				"[folderToBookAction] Failed temporary rename phase:",
				tempRenameResult.error,
			);
			new Notice("Failed to convert folder into a book");
			return null;
		}
	}

	const finalRenameActions = buildFinalRenameActions(plans, needsTempPhase);
	if (finalRenameActions.length > 0) {
		const finalRenameResult = await vam.dispatch(finalRenameActions);
		if (finalRenameResult.isErr()) {
			logger.warn(
				"[folderToBookAction] Failed final rename phase:",
				finalRenameResult.error,
			);
			new Notice("Failed to convert folder into a book");
			return null;
		}
	}

	const processResult = await vam.dispatch(buildProcessActions(plans));
	if (processResult.isErr()) {
		logger.warn(
			"[folderToBookAction] Failed page metadata phase:",
			processResult.error,
		);
		new Notice("Folder renamed, but page metadata update failed");
	}

	new Notice(`Converted folder into ${plans.length} pages`);

	return {
		pageCount: plans.length,
		treeActions: buildSyntheticRenameActions(
			plans,
			codecs,
			folderPathWithRoot,
		),
	};
}

function isFolderInsideLibrary(
	folderPath: SplitPathToFolder,
	rules: CodecRules,
): boolean {
	const libraryPath = [...rules.libraryRootPathParts, rules.libraryRootName];
	const folderPathWithRoot = [...folderPath.pathParts, folderPath.basename];

	return (
		folderPathWithRoot.length >= libraryPath.length &&
		libraryPath.every((part, index) => folderPathWithRoot[index] === part)
	);
}

function readLeadingNumber(basename: string): number | null {
	const match = basename.match(LEADING_NUMBER_PATTERN);
	if (!match?.[1]) {
		return null;
	}

	return Number.parseInt(match[1], 10);
}

function buildPlans(
	sourceFiles: readonly SplitPathToMdFile[],
	folderPath: SplitPathToFolder,
	suffixParts: string[],
	rules: CodecRules,
): FolderToBookPlan[] {
	return sourceFiles.map((sourceFile, pageIndex) => {
		const finalBasename = buildPageBasename(
			pageIndex,
			folderPath.basename,
			suffixParts,
			rules,
		);

		return {
			currentPath: sourceFile,
			finalPath: { ...sourceFile, basename: finalBasename },
			newNodeName: buildPageNodeName(folderPath.basename, pageIndex),
			pageIndex,
			tempPath: null,
		};
	});
}

function buildPageNodeName(folderName: string, pageIndex: number): string {
	return `${folderName}_${PAGE_PREFIX}_${String(pageIndex).padStart(
		PAGE_INDEX_DIGITS,
		"0",
	)}`;
}

function hasRenameCollision(plans: readonly FolderToBookPlan[]): boolean {
	const ownerByBasename = new Map(
		plans.map((plan) => [plan.currentPath.basename, plan.currentPath]),
	);

	return plans.some((plan) => {
		if (plan.currentPath.basename === plan.finalPath.basename) {
			return false;
		}

		const currentOwner = ownerByBasename.get(plan.finalPath.basename);
		return currentOwner !== undefined && currentOwner !== plan.currentPath;
	});
}

function buildTempRenameActions(
	plans: FolderToBookPlan[],
	suffixParts: string[],
	rules: CodecRules,
): VaultAction[] {
	const stamp = `${Date.now()}`;

	return plans.flatMap((plan, index) => {
		if (plan.currentPath.basename === plan.finalPath.basename) {
			return [];
		}

		const tempBasename = buildTempBasename(
			index,
			stamp,
			suffixParts,
			rules,
		);
		plan.tempPath = { ...plan.currentPath, basename: tempBasename };

		return [
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: plan.currentPath,
					to: plan.tempPath,
				},
			},
		];
	});
}

function buildTempBasename(
	index: number,
	stamp: string,
	suffixParts: string[],
	rules: CodecRules,
): string {
	return codecsSerialize(rules, {
		coreName: `__book_tmp_${stamp}_${index}`,
		suffixParts,
	});
}

function codecsSerialize(
	rules: CodecRules,
	input: { coreName: string; suffixParts: string[] },
): string {
	return [input.coreName, ...input.suffixParts].join(rules.suffixDelimiter);
}

function buildFinalRenameActions(
	plans: readonly FolderToBookPlan[],
	usedTempPhase: boolean,
): VaultAction[] {
	return plans.flatMap((plan) => {
		const renameFrom =
			usedTempPhase && plan.tempPath ? plan.tempPath : plan.currentPath;

		if (renameFrom.basename === plan.finalPath.basename) {
			return [];
		}

		return [
			{
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: renameFrom,
					to: plan.finalPath,
				},
			},
		];
	});
}

function buildProcessActions(
	plans: readonly FolderToBookPlan[],
): VaultAction[] {
	return plans.map((plan, index) => {
		const prevPageIdx = index > 0 ? index - 1 : undefined;
		const nextPageIdx = index < plans.length - 1 ? index + 1 : undefined;

		return {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: plan.finalPath,
				transform: buildExistingPageTransform(prevPageIdx, nextPageIdx),
			},
		};
	});
}

function buildSyntheticRenameActions(
	plans: readonly FolderToBookPlan[],
	codecs: Codecs,
	folderPathWithRoot: string[],
): RenameScrollNodeAction[] {
	const segmentIdChainToParent =
		buildSectionChainFromPathParts(folderPathWithRoot);

	return plans.flatMap((plan) => {
		if (plan.currentPath.basename === plan.finalPath.basename) {
			return [];
		}

		const parsedBasename = codecs.suffix.parseSeparatedSuffix(
			plan.currentPath.basename,
		);
		if (parsedBasename.isErr()) {
			logger.warn(
				"[folderToBookAction] Failed to parse existing basename:",
				plan.currentPath,
				parsedBasename.error,
			);
			return [];
		}

		const segmentId = codecs.segmentId.serializeSegmentId<"Scroll">({
			coreName: parsedBasename.value.coreName,
			extension: MD,
			targetKind: TreeNodeKind.Scroll,
		});
		const renameAction: RenameScrollNodeAction = {
			actionType: TreeActionType.Rename,
			newNodeName: plan.newNodeName,
			targetLocator: {
				segmentId,
				segmentIdChainToParent,
				targetKind: TreeNodeKind.Scroll,
			},
		};

		return [renameAction];
	});
}
