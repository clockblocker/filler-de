/**
 * The shapes resolution and Knowledge production share (#64).
 */
import type { DumdictVaultStore } from "@textfresser/dictionary";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Data } from "effect";

/** Whether the occurrence created the Reading (`New`) or reused a stored one (`TopUp`). */
export type KnowledgeOrigin = "New" | "TopUp";

/** A Knowledge change on a German Reading, as `knowledge.produce` returns it. */
export type GermanKnowledgeChange = Dumrel.KnowledgeChange<
	Dumling.Reading<"de">
>;

/** A generated Semantic Relation to a German Unit Shadow. */
export type GermanPendingRelation = Dumrel.PendingSemanticRelation & {
	readonly target: { readonly language: "de" };
};

/**
 * The part of the dictionary store resolution reads and commits through.
 * Every commit goes through `transact`, which plans from its own view.
 */
export type ResolutionStore = Pick<
	DumdictVaultStore,
	| "lemmaCandidates"
	| "lemmaNote"
	| "lemmaNotes"
	| "readingLocation"
	| "scrollRefNames"
	| "settleBreakdown"
	| "transact"
>;

/** One Reading whose Knowledge an occurrence asks dumgen for, after its commit. */
export type KnowledgeJob = {
	readonly reading: Dumling.Reading<"de">;
	readonly attestation: Dumling.Attestation<"de">;
	readonly sentence: {
		readonly segments: readonly { readonly text: string }[];
		readonly target: readonly number[];
	};
	readonly origin: KnowledgeOrigin;
	/** The Reading note's vault path, whose clicks wait for the Knowledge. */
	readonly readingPath: string;
	/** How the user knows the Reading: `See 🌊`. */
	readonly label: string;
};

/** A dictionary read or commit failed, or kept conflicting past its retries. */
export class DictionaryCommitFailed extends Data.TaggedError(
	"DictionaryCommitFailed",
)<{
	readonly cause: unknown;
	readonly message: string;
}> {}
