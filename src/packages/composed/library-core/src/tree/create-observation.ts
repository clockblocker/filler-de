import { SplitPathKind } from "@textfresser/vault-action-manager";
import type {
	CanonicalSplitPathInsideLibraryOf,
	CodecError,
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../codecs";
import { isCodexSplitPath } from "../healer/library-tree/codex/helpers";
import type { CreateTreeLeafAction } from "../healer/library-tree/tree-action/types/tree-action";
import { TreeActionType } from "../healer/library-tree/tree-action/types/tree-action";
import { tryCanonicalizeSplitPathToDestination } from "../healer/library-tree/tree-action/utils/canonical-naming/canonicalize-to-destination";
import type { TreeNodeStatus } from "../healer/library-tree/tree-node/types/atoms";
import { TreeNodeKind } from "../healer/library-tree/tree-node/types/atoms";
import type { ChangePolicy } from "./change-policy";
import { inferCreatePolicy } from "./create-policy";

export type CreateObservationPath =
	| SplitPathToFileInsideLibrary
	| SplitPathToMdFileInsideLibrary;

export type CreateObservationDiagnostic =
	| {
			readonly cause: {
				readonly kind: "CreateCanonicalizationError";
				readonly message: string;
			};
			readonly kind: "CanonicalizationFailed";
			readonly observedSplitPath: CreateObservationPath;
			readonly policy: ChangePolicy;
	  }
	| {
			readonly canonicalSplitPath: CanonicalSplitPathInsideLibraryOf<
				typeof SplitPathKind.File | typeof SplitPathKind.MdFile
			>;
			readonly cause: CodecError;
			readonly kind: "LocatorConstructionFailed";
			readonly observedSplitPath: CreateObservationPath;
			readonly policy: ChangePolicy;
	  }
	| {
			readonly actualKind: TreeNodeKind;
			readonly expectedKind:
				| typeof TreeNodeKind.File
				| typeof TreeNodeKind.Scroll;
			readonly kind: "TargetKindMismatch";
			readonly observedSplitPath: CreateObservationPath;
			readonly policy: ChangePolicy;
	  };

export type CreateObservationTranslation =
	| {
			readonly action: CreateTreeLeafAction;
			readonly kind: "Translated";
			readonly policy: ChangePolicy;
	  }
	| {
			readonly kind: "IgnoredGeneratedCodex";
			readonly observedSplitPath: CreateObservationPath;
	  }
	| {
			readonly diagnostic: CreateObservationDiagnostic;
			readonly kind: "Invalid";
	  };

/**
 * Translate one Library-scoped leaf observation into its canonical Create
 * Tree Action. This is the shared naming boundary for startup snapshots and
 * materialized live Create events; it performs no filesystem I/O.
 */
export function translateCreateObservation(
	observedSplitPath: CreateObservationPath,
	codecs: Codecs,
	initialStatus?: TreeNodeStatus,
): CreateObservationTranslation {
	if (isCodexSplitPath(observedSplitPath)) {
		return {
			kind: "IgnoredGeneratedCodex",
			observedSplitPath,
		};
	}

	const policy = inferCreatePolicy(observedSplitPath);
	const canonicalResult = tryCanonicalizeSplitPathToDestination(
		observedSplitPath,
		policy,
		undefined,
		codecs,
	);
	if (canonicalResult.isErr()) {
		return {
			diagnostic: {
				cause: {
					kind: "CreateCanonicalizationError",
					message: canonicalResult.error,
				},
				kind: "CanonicalizationFailed",
				observedSplitPath,
				policy,
			},
			kind: "Invalid",
		};
	}

	const locatorResult =
		codecs.locator.canonicalSplitPathInsideLibraryToLocator(
			canonicalResult.value,
		);
	if (locatorResult.isErr()) {
		return {
			diagnostic: {
				canonicalSplitPath: canonicalResult.value,
				cause: locatorResult.error,
				kind: "LocatorConstructionFailed",
				observedSplitPath,
				policy,
			},
			kind: "Invalid",
		};
	}

	const targetLocator = locatorResult.value;
	if (
		observedSplitPath.kind === SplitPathKind.File &&
		targetLocator.targetKind === TreeNodeKind.File
	) {
		return {
			action: {
				actionType: TreeActionType.Create,
				observedSplitPath,
				targetLocator,
			},
			kind: "Translated",
			policy,
		};
	}
	if (
		observedSplitPath.kind === SplitPathKind.MdFile &&
		targetLocator.targetKind === TreeNodeKind.Scroll
	) {
		return {
			action: {
				actionType: TreeActionType.Create,
				...(initialStatus === undefined ? {} : { initialStatus }),
				observedSplitPath,
				targetLocator,
			},
			kind: "Translated",
			policy,
		};
	}

	return {
		diagnostic: {
			actualKind: targetLocator.targetKind,
			expectedKind:
				observedSplitPath.kind === SplitPathKind.MdFile
					? TreeNodeKind.Scroll
					: TreeNodeKind.File,
			kind: "TargetKindMismatch",
			observedSplitPath,
			policy,
		},
		kind: "Invalid",
	};
}
