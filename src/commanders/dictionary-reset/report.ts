/**
 * The reset's report (#65, #117), as Markdown: its source, what Collect
 * found, then either what Execute would do (Dry run) or what it did, down
 * to the Lemma, Reading and Crossroad notes `Worter/` holds afterwards.
 * Freeform text is quoted in fences, so the report renders none of its
 * links, embeds or block IDs. A provider's failure shows as one line, not
 * its JSON body (#147).
 */
import { conciseFailure } from "../../managers/dumgen/provider-failure";
import type { ResetLayout } from "./layout";
import type { OldMetaShape, OldNoteKind } from "./old-notes";
import {
	type Collected,
	type PlannedAttestation,
	type ResetPlan,
	WORTER,
} from "./plan";

export type RegenerationResult =
	| {
			readonly _tag: "Regenerated";
			readonly scrollPath: string;
			readonly readingPath: string;
			readonly lemmaPath: string;
			/** How many occurrences Classify linked to the Reading. */
			readonly linked: number;
	  }
	| { readonly _tag: "Unresolved"; readonly reason: string }
	| { readonly _tag: "Cancelled" };

/** Where freeform text went: its Reading note, or its Lemma note when the sense was ambiguous. */
type Placed = {
	readonly path: string;
	readonly to: "Reading" | "Lemma";
};

export type FreeformResult =
	| ({ readonly _tag: "Attached" } & Placed)
	| ({ readonly _tag: "AlreadyThere" } & Placed)
	| { readonly _tag: "Unplaced"; readonly reason: string };

export type ResetExecution = {
	/**
	 * Where `Worter/` was moved before regenerating; undefined when there was
	 * no `Worter/`, or it was empty, so nothing needed moving.
	 */
	readonly backupFolder: string | undefined;
	/** Per planned attestation, in the plan's order. */
	readonly regenerations: readonly (RegenerationResult | undefined)[];
	/** Per planned freeform Block, in the plan's order. */
	readonly freeform: readonly FreeformResult[];
	readonly cancelled: boolean;
	/** What Classify told the user while it ran: links it skipped and the like. */
	readonly notices: readonly string[];
	/** What `Worter/` holds once the reset is done; undefined if it could not be read. */
	readonly layout: ResetLayout | undefined;
};

export type ResetCounts = {
	readonly notes: number;
	readonly byKind: Readonly<Record<OldNoteKind, number>>;
	readonly byMetaShape: Readonly<Record<OldMetaShape, number>>;
	readonly attestations: number;
	readonly readyAttestations: number;
	readonly duplicateAttestations: number;
	readonly unresolvableAttestations: number;
	readonly freeformBlocks: number;
	readonly attachableFreeform: number;
	readonly unplaceableFreeform: number;
	readonly otherFiles: number;
};

const countKinds = (collected: Collected) => {
	const byKind: Record<OldNoteKind, number> = {
		Empty: 0,
		Entry: 0,
		FreeformOnly: 0,
		InflectionHost: 0,
		NewFormat: 0,
		Obsolete: 0,
		Stub: 0,
	};
	for (const note of collected.notes) byKind[note.kind] += 1;
	return byKind;
};

/** `79 (8 Empty, 8 Entry, …)` */
const kindSummary = (byKind: Readonly<Record<OldNoteKind, number>>) => {
	const total = Object.values(byKind).reduce((sum, count) => sum + count, 0);
	const parts = Object.entries(byKind)
		.filter(([, count]) => count > 0)
		.map(([kind, count]) => `${count} ${kind}`);
	return parts.length === 0 ? `${total}` : `${total} (${parts.join(", ")})`;
};

export function countPlan(plan: ResetPlan): ResetCounts {
	const byKind = countKinds(plan.collected);
	const byMetaShape: Record<OldMetaShape, number> = {
		Entity: 0,
		LexicalMeta: 0,
		Unrecognized: 0,
	};
	for (const note of plan.collected.notes)
		for (const shape of note.metaShapes) byMetaShape[shape] += 1;
	const tagged = (tag: PlannedAttestation["outcome"]["_tag"]) =>
		plan.attestations.filter(({ outcome }) => outcome._tag === tag).length;
	const attachable = plan.freeform.filter(
		({ outcome }) => outcome._tag === "WouldAttach",
	).length;
	return {
		attachableFreeform: attachable,
		attestations: plan.attestations.length,
		byKind,
		byMetaShape,
		duplicateAttestations: tagged("Duplicate"),
		freeformBlocks: plan.freeform.length,
		notes: plan.collected.notes.length,
		otherFiles: plan.collected.otherFiles.length,
		readyAttestations: tagged("Ready"),
		unplaceableFreeform: plan.freeform.length - attachable,
		unresolvableAttestations: tagged("Unresolvable"),
	};
}

/**
 * A path as a link that names its file exactly: `[[Folder/Note|Note]]`. In
 * a table cell its pipe is escaped.
 */
function noteLink(path: string, inTable = false): string {
	const target = path.endsWith(".md") ? path.slice(0, -3) : path;
	const shown = target.split("/").at(-1) ?? target;
	return `[[${target}${inTable ? "\\|" : "|"}${shown}]]`;
}

function fenced(text: string): string {
	const longest = Math.max(
		2,
		...[...text.matchAll(/`+/gu)].map(([run]) => run.length),
	);
	const fence = "`".repeat(longest + 1);
	return `${fence}text\n${text}\n${fence}`;
}

/** Where a note of `Worter/` sits once it is backed up. */
const movedPath = (path: string, backupFolder: string | undefined) =>
	backupFolder === undefined || !path.startsWith(`${WORTER}/`)
		? path
		: `${backupFolder}${path.slice(WORTER.length)}`;

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`;

/** The basename of a note path. */
const nameOf = (path: string) =>
	(path.split("/").at(-1) ?? path).replace(/\.md$/u, "");

/** The folder of a note path. */
const folderOf = (path: string) => path.split("/").slice(0, -1).join("/");

/** Each Lemma note with the Reading notes beside it named `<emoji> <its name>`. */
function readingsByLemma(layout: ResetLayout) {
	const owner = (reading: string) =>
		layout.lemmaNotes
			.filter(
				(lemma) =>
					folderOf(lemma) === folderOf(reading) &&
					nameOf(reading).endsWith(` ${nameOf(lemma)}`),
			)
			.sort((a, b) => nameOf(b).length - nameOf(a).length)[0];
	const byLemma = new Map<string, string[]>(
		layout.lemmaNotes.map((lemma) => [lemma, []]),
	);
	const orphans: string[] = [];
	for (const reading of layout.readingNotes) {
		const lemma = owner(reading);
		if (lemma === undefined) orphans.push(reading);
		else byLemma.get(lemma)?.push(reading);
	}
	return { byLemma, orphans };
}

function layoutLines(layout: ResetLayout): string[] {
	const lines = [
		`## ${WORTER}/ now (${plural(layout.lemmaNotes.length, "Lemma note")}, ${plural(layout.readingNotes.length, "Reading note")}, ${plural(layout.crossroadNotes.length, "Crossroad note")})`,
		"",
	];
	const { byLemma, orphans } = readingsByLemma(layout);
	if (byLemma.size === 0) lines.push("No Lemma notes.");
	for (const [lemma, readings] of byLemma)
		lines.push(
			`- ${noteLink(lemma)}: ${readings.length === 0 ? "no Reading note" : readings.map((reading) => noteLink(reading)).join(", ")}`,
		);
	for (const reading of orphans)
		lines.push(`- ${noteLink(reading)}, beside no Lemma note`);
	lines.push(
		"",
		`Crossroad notes: ${layout.crossroadNotes.length === 0 ? "none" : layout.crossroadNotes.map((path) => noteLink(path)).join(", ")}.`,
		"",
		layout.shadowNotes.length === 0
			? "No Shadow notes."
			: `**Shadow notes, which the dictionary should never write:** ${layout.shadowNotes.map((path) => noteLink(path)).join(", ")}.`,
	);
	if (layout.otherNotes.length > 0)
		lines.push(
			"",
			`Other notes in ${WORTER}/: ${layout.otherNotes.map((path) => noteLink(path)).join(", ")}.`,
		);
	lines.push("");
	return lines;
}

const cell = (text: string) => text.replace(/\|/gu, "\\|").replace(/\n/gu, " ");

export function renderReport(
	plan: ResetPlan,
	execution?: ResetExecution,
): string {
	const counts = countPlan(plan);
	const backup = execution?.backupFolder;
	const fromWorter = plan.source === WORTER;
	const oldNote = (path: string, inTable = false) =>
		noteLink(fromWorter ? movedPath(path, backup) : path, inTable);
	/** `Worter/` as Collect read it: the source itself, or what it held beside a backup source. */
	const worter = fromWorter ? plan.collected : plan.current;
	const lines: string[] = [];
	lines.push(
		execution
			? `# Dictionary reset${execution.cancelled ? " (cancelled)" : ""}`
			: "# Dictionary reset: dry run",
		"",
		`Source of the old notes: \`${plan.source}/\`.`,
		"",
	);
	if (execution) {
		const moved =
			backup === undefined
				? `There was no ${WORTER}/ to back up.`
				: `${WORTER}/ was moved to \`${backup}/\`${fromWorter ? ", old notes and all" : ""}.`;
		lines.push(
			`${moved} ${fromWorter ? "" : `The old notes stay in \`${plan.source}/\`. `}Nothing was deleted.`,
			"",
		);
	} else
		lines.push(
			"Nothing was moved, written or asked of a provider. Execute would do the following.",
			"",
		);

	if (!fromWorter) {
		lines.push(`## ${WORTER}/ before the reset`, "");
		if (
			worter === undefined ||
			worter.notes.length + worter.otherFiles.length === 0
		)
			lines.push(
				`${WORTER}/ is missing or empty, so there is nothing to back up.`,
			);
		else {
			lines.push(
				`- Notes: ${kindSummary(countKinds(worter))}`,
				...(worter.otherFiles.length > 0
					? [`- Other files: ${worter.otherFiles.length}`]
					: []),
				"",
				execution
					? `They were backed up to \`${backup}/\` before regenerating, and none of them was read.`
					: `Execute first moves them to a new \`${WORTER} backup <date time>/\` folder, checks every file arrived there unchanged, and reads none of them.`,
			);
			const unread = worter.notes.filter(
				({ kind }) => kind !== "Obsolete" && kind !== "NewFormat",
			);
			if (unread.length > 0)
				lines.push(
					"",
					`- **Old notes that are backed up but not regenerated, because the source is \`${plan.source}/\`:** ${unread.map(({ path }) => noteLink(movedPath(path, backup))).join(", ")}`,
				);
		}
		lines.push("");
	}

	lines.push(
		"## Collected",
		"",
		`- Notes: ${kindSummary(counts.byKind)}`,
		`- Metadata entries: ${counts.byMetaShape.LexicalMeta} lexicalMeta, ${counts.byMetaShape.Entity} entity, ${counts.byMetaShape.Unrecognized} unrecognized`,
		`- Attestation embeds: ${counts.attestations} (${counts.readyAttestations} to regenerate, ${counts.duplicateAttestations} duplicate, ${counts.unresolvableAttestations} unresolvable)`,
		`- Freeform Blocks: ${counts.freeformBlocks} (${counts.attachableFreeform} with a Lemma to regenerate, ${counts.unplaceableFreeform} without)`,
	);
	if (counts.otherFiles > 0)
		lines.push(`- Other files, kept in the backup: ${counts.otherFiles}`);
	const obsolete = plan.collected.notes.filter(
		({ kind }) => kind === "Obsolete",
	);
	if (fromWorter && obsolete.length > 0)
		lines.push(
			`- Notes in the obsolete marker format, backed up and never read: ${obsolete.length}`,
		);
	const newFormat = (worter?.notes ?? []).filter(
		({ kind }) => kind === "NewFormat",
	);
	if (newFormat.length > 0)
		lines.push(
			`- **Notes in ${WORTER}/ already in the current layout, so Execute refuses to run:** ${newFormat.map(({ path }) => noteLink(path)).join(", ")}`,
		);
	const withFrontmatter = plan.collected.notes.filter(
		({ frontmatter }) => frontmatter,
	);
	if (withFrontmatter.length > 0)
		lines.push(
			`- Frontmatter, kept only in the backup: ${withFrontmatter.map(({ path }) => oldNote(path)).join(", ")}`,
		);
	const unreadable = plan.collected.notes.filter(
		({ unreadableMeta }) => unreadableMeta,
	);
	if (unreadable.length > 0)
		lines.push(
			`- Metadata that could not be read: ${unreadable.map(({ path }) => oldNote(path)).join(", ")}`,
		);
	lines.push("");

	const regenerations = plan.attestations.map((planned, index) => ({
		planned,
		result: execution?.regenerations[index],
	}));
	if (execution) {
		const regenerated = new Map<string, string[]>();
		for (const { planned, result } of regenerations)
			if (result?._tag === "Regenerated")
				regenerated.set(result.readingPath, [
					...(regenerated.get(result.readingPath) ?? []),
					`${noteLink(result.scrollPath)} ^${planned.attestation.blockId} (${result.linked} linked)`,
				]);
		lines.push(`## Regenerated Readings (${regenerated.size})`, "");
		if (regenerated.size === 0) lines.push("None.");
		for (const [readingPath, from] of regenerated)
			lines.push(`- ${noteLink(readingPath)}, from ${from.join(", ")}`);
		if (
			regenerations.some(
				({ result }) =>
					result?._tag === "Regenerated" && result.linked === 0,
			)
		)
			lines.push(
				"",
				"Classify leaves links it did not write alone, such as an old `[[Fahrer]]`, so an attestation with 0 linked keeps its old link in its Scroll. That link may now resolve to the backup: point it at the new note, or unlink the word and Classify it again.",
			);
		lines.push("");
		if (execution.layout) lines.push(...layoutLines(execution.layout));
		else
			lines.push(
				`## ${WORTER}/ now`,
				"",
				`${WORTER}/ could not be read after the reset.`,
				"",
			);
	} else {
		lines.push(
			`## Attestations to regenerate (${counts.readyAttestations})`,
			"",
			"| Headword | Old note | Source | Segment | Found by |",
			"| --- | --- | --- | --- | --- |",
		);
		for (const { planned } of regenerations) {
			const { outcome } = planned;
			if (outcome._tag !== "Ready") continue;
			lines.push(
				`| ${cell(planned.headword)} | ${oldNote(planned.notePath, true)} | ${noteLink(outcome.scrollPath, true)} ^${cell(planned.attestation.blockId)} | ${cell(outcome.text)} | ${outcome.via === "Link" ? "link" : "text"}${outcome.blockIdLines > 1 ? `, first of ${outcome.blockIdLines} ^${cell(planned.attestation.blockId)}` : ""} |`,
			);
		}
		lines.push(
			"",
			`Each one is classified again into a fresh ${WORTER}/: a Lemma note, a Reading note per sense and a Crossroad note per spelling. No Shadow note is written.`,
			"",
		);
	}

	const unresolved = regenerations.flatMap(({ planned, result }) => {
		if (planned.outcome._tag === "Unresolvable")
			return [{ planned, reason: planned.outcome.reason }];
		if (result?._tag === "Unresolved")
			return [{ planned, reason: result.reason }];
		if (result?._tag === "Cancelled")
			return [{ planned, reason: "the reset was cancelled before it" }];
		return [];
	});
	lines.push(
		`## Attestations ${execution ? "it could not resolve" : "that cannot be resolved"} (${unresolved.length})`,
		"",
	);
	if (unresolved.length === 0) lines.push("None.");
	for (const { planned, reason } of unresolved)
		lines.push(
			`- \`${planned.attestation.embed}\` in ${oldNote(planned.notePath)} (${cell(planned.headword)}): ${conciseFailure(reason)}`,
		);
	lines.push("");

	const freeform = plan.freeform.map((planned, index) => ({
		planned,
		result: execution?.freeform[index],
	}));
	const placed = freeform.filter(({ planned, result }) =>
		execution
			? result?._tag === "Attached" || result?._tag === "AlreadyThere"
			: planned.outcome._tag === "WouldAttach",
	);
	const unplaced = freeform.filter((entry) => !placed.includes(entry));
	lines.push(
		`## Freeform text ${execution ? "re-attached" : "to re-attach"} (${placed.length})`,
		"",
	);
	if (placed.length === 0) lines.push("None.");
	for (const { planned, result } of placed)
		lines.push(
			result && result._tag !== "Unplaced"
				? `- From ${oldNote(planned.notePath)}, line ${planned.block.line}, to ${noteLink(result.path)}${result.to === "Lemma" ? ", its Lemma note, since its sense is ambiguous" : ""}${result._tag === "AlreadyThere" ? " (it was already there)" : ""}`
				: `- From ${oldNote(planned.notePath)}, line ${planned.block.line}, to the Reading note regenerated for "${planned.headword}"${planned.block.emojis.length > 0 ? ` ${planned.block.emojis.join(" ")}` : ""}, or its Lemma note if the sense is ambiguous`,
		);
	lines.push("");
	lines.push(
		`## Freeform text ${execution ? "it could not place" : "that cannot be placed"} (${unplaced.length})`,
		"",
	);
	if (unplaced.length === 0) lines.push("None.");
	for (const { planned, result } of unplaced) {
		const reason =
			result?._tag === "Unplaced"
				? result.reason
				: planned.outcome._tag === "Unplaceable"
					? planned.outcome.reason
					: "it was not placed";
		lines.push(
			`### ${oldNote(planned.notePath)}, line ${planned.block.line}`,
			"",
			`${reason[0]?.toUpperCase() ?? ""}${reason.slice(1)}.`,
			"",
			fenced(planned.block.text),
			"",
		);
	}
	if (execution && execution.notices.length > 0) {
		lines.push("## Notices", "");
		for (const notice of execution.notices)
			lines.push(`- ${conciseFailure(notice)}`);
		lines.push("");
	}
	return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}
