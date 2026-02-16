import type {
	GermanGenus,
	NounInflectionCell,
} from "../../../../../linguistics/de/lexem/noun";
import type { DictEntry } from "../../../domain/dict-note/types";
import type { MorphemeItem } from "../../../domain/morpheme/morpheme-formatter";
import type { ResolvedEntryState } from "./resolve-existing-entry";
import type { ParsedRelation } from "./section-generation-types";

export type GenerateSectionsResult = ResolvedEntryState & {
	allEntries: DictEntry[];
	/** Raw relation data from LLM — used by propagate-relations step. Empty for re-encounters. */
	relations: ParsedRelation[];
	/** Structured noun inflection cells — used by propagate-inflections step. Empty for non-nouns / re-encounters. */
	inflectionCells: NounInflectionCell[];
	/** Noun genus from LexemEnrichment — required for noun inflection propagation headers. */
	nounInflectionGenus?: GermanGenus;
	/** Resolved morpheme items — used by propagate-morphemes step. Empty for re-encounters. */
	morphemes: MorphemeItem[];
	/** Section names that failed LLM generation but were optional — entry was still created. */
	failedSections: string[];
	/** Block ID of the entry to scroll to after dispatch. */
	targetBlockId?: string;
};
