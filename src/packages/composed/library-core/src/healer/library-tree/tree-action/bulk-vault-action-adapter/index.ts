import type { Codecs } from "../../../../codecs";
import {
	type LibraryBulk,
	makeLibraryScope,
} from "../../../../tree/library-scope";
import { extractInvalidCodexesFromScopedBulk } from "../../codex/codex-impact-to-actions";
import type { HealingAction } from "../../types/healing-action";
import type { TreeAction } from "../types/tree-action";
import { materializeScopedBulk } from "./layers/materialized-node-events/materialize-scoped-bulk";
import { translateMaterializedEvents } from "./layers/translate-material-event/translate-material-events";

export type BulkInterpretation = {
	invalidCodexActions: HealingAction[];
	treeActions: TreeAction[];
};

export type BulkInterpreter = (bulk: LibraryBulk) => BulkInterpretation;

/**
 * Configures the complete Library bulk-planning module once.
 *
 * Each semantic bulk crosses this single interface exactly once. Scoping,
 * materialization, tree-intent inference, translation, and codex validation
 * remain synchronous implementation details.
 */
export function makeBulkInterpreter(codecs: Codecs): BulkInterpreter {
	const libraryScope = makeLibraryScope(codecs.rules);

	return (bulk) => {
		const scopedBulk = libraryScope.toLibraryBulk(bulk);

		return {
			invalidCodexActions: extractInvalidCodexesFromScopedBulk(
				scopedBulk,
				codecs,
			),
			treeActions: translateMaterializedEvents(
				materializeScopedBulk(scopedBulk),
				codecs,
			),
		};
	};
}
