/**
 * The reset's Collect and plan stages (#65, #117), shared by Dry run and
 * Execute. Collect reads every old note in the source folder, `Worter/` or
 * a `Worter backup …` folder, and, when the source is a backup, what
 * `Worter/` holds now; the plan finds each attestation's source block and
 * Segment, and decides which freeform Blocks have a regenerated Lemma to go
 * to. Both only read.
 */
import { freeformPlacementProblem } from "@textfresser/dictionary";
import { Effect } from "effect";
import type { SourceRange } from "../classify/types";
import {
	type LocatedAttestation,
	locateAttestation,
} from "./locate-attestation";
import {
	type OldAttestation,
	type OldFreeformBlock,
	type OldNote,
	readOldNote,
} from "./old-notes";

/** The dictionary's folder, which the reset backs up and regenerates into. */
export const WORTER = "Worter";

export type OldFile = { readonly path: string; readonly content: string };

export type Collected = {
	readonly notes: readonly OldNote[];
	/** Files in the folder that are not Markdown; a backup keeps them too. */
	readonly otherFiles: readonly string[];
};

export function collectOldNotes(
	files: readonly OldFile[],
	otherFiles: readonly string[] = [],
): Collected {
	return {
		notes: [...files]
			.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
			.map(({ content, path }) => readOldNote(path, content)),
		otherFiles: [...otherFiles].sort(),
	};
}

/** Reads the plan needs: where an embed's link path leads, and a file's content. */
export type ResetSources = {
	/** The Markdown file `linkpath` resolves to from `fromPath`, as Obsidian resolves links. */
	readonly resolveLink: (
		linkpath: string,
		fromPath: string,
	) => Effect.Effect<string | undefined>;
	readonly read: (path: string) => Effect.Effect<string | undefined>;
};

export type AttestationTarget = {
	readonly scrollPath: string;
	readonly selection: SourceRange;
	readonly text: string;
	readonly via: "Link" | "Text";
	readonly blockIdLines: number;
};

export type PlannedAttestation = {
	readonly notePath: string;
	readonly headword: string;
	readonly forms: readonly string[];
	readonly attestation: OldAttestation;
	readonly outcome:
		| ({ readonly _tag: "Ready" } & AttestationTarget)
		/** The same Segment as an earlier attestation; it is regenerated once. */
		| {
				readonly _tag: "Duplicate";
				readonly of: number;
				readonly scrollPath: string;
		  }
		| { readonly _tag: "Unresolvable"; readonly reason: string };
};

type PlannedFreeform = {
	readonly notePath: string;
	readonly headword: string;
	readonly block: OldFreeformBlock;
	readonly outcome:
		| { readonly _tag: "WouldAttach" }
		| { readonly _tag: "Unplaceable"; readonly reason: string };
};

export type ResetPlan = {
	/** The folder the old notes are read from: `Worter` or a backup folder. */
	readonly source: string;
	/** The source's notes. */
	readonly collected: Collected;
	/**
	 * `Worter/` as it is now, when the source is a backup folder and `Worter/`
	 * is there: Execute backs it up first and reads nothing from it.
	 */
	readonly current?: Collected;
	readonly attestations: readonly PlannedAttestation[];
	readonly freeform: readonly PlannedFreeform[];
};

/** How headwords are matched: without case, so `See` meets `see`. */
export const headwordKey = (headword: string): string =>
	headword.trim().toLowerCase();

/** Why a located attestation cannot run, in the report's words. */
function locateFailure(
	located: Exclude<LocatedAttestation, { _tag: "Located" }>,
	attestation: OldAttestation,
	forms: readonly string[],
): string {
	return located._tag === "BlockMissing"
		? `its source has no block ^${attestation.blockId}`
		: `none of ${forms.map((form) => `"${form}"`).join(", ")} occurs in block ^${attestation.blockId}`;
}

/** Locates one attestation in its source as the source reads now. */
export const targetAttestation = Effect.fnUntraced(function* (
	sources: ResetSources,
	note: Pick<OldNote, "path" | "forms">,
	attestation: OldAttestation,
	/**
	 * Folders a source may not lie in: `Worter/`, the folder the old notes
	 * come from and, once it exists, the new backup. Classify writes into
	 * its source, and these stay untouched.
	 */
	protectedFolders: readonly string[],
): Effect.fn.Return<
	| ({
			readonly _tag: "Ready";
			/** The source's content the selection indexes. */
			readonly content: string;
	  } & AttestationTarget)
	| { readonly _tag: "Unresolvable"; readonly reason: string }
> {
	const scrollPath = yield* sources.resolveLink(
		attestation.linkpath,
		note.path,
	);
	if (scrollPath === undefined)
		return {
			_tag: "Unresolvable",
			reason: `no note "${attestation.linkpath}" exists`,
		} as const;
	if (protectedFolders.some((folder) => scrollPath.startsWith(`${folder}/`)))
		return {
			_tag: "Unresolvable",
			reason: `its source ${scrollPath} is a dictionary note, which the reset backs up and never writes to`,
		} as const;
	const content = yield* sources.read(scrollPath);
	if (content === undefined)
		return {
			_tag: "Unresolvable",
			reason: `its source ${scrollPath} could not be read`,
		} as const;
	const located = locateAttestation(content, attestation.blockId, note.forms);
	if (located._tag !== "Located")
		return {
			_tag: "Unresolvable",
			reason: locateFailure(located, attestation, note.forms),
		} as const;
	return {
		_tag: "Ready",
		blockIdLines: located.blockIdLines,
		content,
		scrollPath,
		selection: located.selection,
		text: located.text,
		via: located.via,
	} as const;
});

/**
 * Whether a freeform Block would attach: some attestation of its headword
 * can be regenerated, and its text passes the round-trip check the store
 * runs when Execute places it, on a probe note.
 */
function freeformOutcome(
	text: string,
	regenerable: boolean,
	headword: string,
): PlannedFreeform["outcome"] {
	if (!regenerable)
		return {
			_tag: "Unplaceable",
			reason: `no attestation of "${headword}" can be regenerated`,
		};
	const problem = freeformPlacementProblem(text);
	return problem === undefined
		? { _tag: "WouldAttach" }
		: {
				_tag: "Unplaceable",
				reason: `its text cannot be placed in a note: ${problem}`,
			};
}

/**
 * Plans the reset from what Collect read. An attestation is Ready when its
 * source block and Segment are found, a Duplicate when an earlier one
 * names the same Segment. A freeform Block would attach when some Ready
 * attestation has its note's headword and its text round-trips through a
 * note, as Execute checks it.
 */
export const planReset = Effect.fnUntraced(function* (
	sources: ResetSources,
	collect: {
		readonly source: string;
		readonly collected: Collected;
		readonly current?: Collected;
	},
): Effect.fn.Return<ResetPlan> {
	const { collected, source } = collect;
	const attestations: PlannedAttestation[] = [];
	const seen = new Map<string, number>();
	for (const note of collected.notes)
		for (const attestation of note.attestations) {
			const target = yield* targetAttestation(
				sources,
				note,
				attestation,
				[...new Set([WORTER, source])],
			);
			const base = {
				attestation,
				forms: note.forms,
				headword: note.headword,
				notePath: note.path,
			};
			if (target._tag === "Ready") {
				const { content: _content, ...ready } = target;
				const key = `${target.scrollPath}\u0000${target.selection.from}\u0000${target.selection.to}`;
				const earlier = seen.get(key);
				if (earlier !== undefined) {
					attestations.push({
						...base,
						outcome: {
							_tag: "Duplicate",
							of: earlier,
							scrollPath: target.scrollPath,
						},
					});
					continue;
				}
				seen.set(key, attestations.length);
				attestations.push({ ...base, outcome: ready });
				continue;
			}
			attestations.push({ ...base, outcome: target });
		}

	const ready = new Set(
		attestations.flatMap(({ headword, outcome }) =>
			outcome._tag === "Unresolvable" ? [] : [headwordKey(headword)],
		),
	);
	const freeform: PlannedFreeform[] = collected.notes.flatMap((note) =>
		note.freeform.map((block) => ({
			block,
			headword: note.headword,
			notePath: note.path,
			outcome: freeformOutcome(
				block.text,
				ready.has(headwordKey(note.headword)),
				note.headword,
			),
		})),
	);
	return {
		attestations,
		collected,
		...(collect.current === undefined ? {} : { current: collect.current }),
		freeform,
		source,
	};
});
