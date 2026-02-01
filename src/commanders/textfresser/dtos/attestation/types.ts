import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";

type AttestationSource = {
	/** Formatted for sourcing: ![[file#^blockId|^]] if block ID exists, else raw block text */
	ref: string;

	/** Raw paragraph/block content where the wikilink was clicked */
	textRaw: string;

	/** Stripped of decorations; only the target's [surface] is marked with single square brackets */
	textWithOnlyTargetMarked: string;

	/** Path to the file that contains the block */
	path: SplitPathToMdFile;
};

// Wikilinks are formatted either as [[surface]] or [[lemma|surface]]
type AttestationTarget = {
	surface: string;
	lemma?: string;
};

export type Attestation = {
	source: AttestationSource;
	target: AttestationTarget;
};
