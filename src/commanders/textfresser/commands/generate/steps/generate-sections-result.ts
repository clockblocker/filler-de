import type { DictEntry } from "../../../domain/dict-note/types";
import type { ResolvedEntryState } from "./resolve-existing-entry";
import type { GeneratedPropagationArtifacts } from "./section-generation-types";

export type GenerateSectionsResult = ResolvedEntryState &
	GeneratedPropagationArtifacts & {
	allEntries: DictEntry[];
	/** Section names that failed LLM generation but were optional — entry was still created. */
	failedSections: string[];
	/** Block ID of the entry to scroll to after dispatch. */
	targetBlockId?: string;
};
