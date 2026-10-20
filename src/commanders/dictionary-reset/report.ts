/**
 * The reset's report (#65), as Markdown: what Collect found, then either
 * what Execute would do (Dry run) or what it did. Freeform text is quoted
 * in fences, so the report renders none of its links, embeds or block IDs.
 */
import type { OldMetaShape, OldNoteKind } from "./old-notes";
import type { PlannedAttestation, ResetPlan } from "./plan";

export type RegenerationResult =
	| {
			readonly _tag: "Regenerated";
			readonly scrollPath: string;
			readonly lemmaPath: string;
			readonly readingBlockId: string;
			/** How many occurrences Classify linked to the Reading. */
			readonly linked: number;
	  }
	| { readonly _tag: "Unresolved"; readonly reason: string }
	| { readonly _tag: "Cancelled" };

export type FreeformResult =
	| { readonly _tag: "Attached"; readonly lemmaPath: string }
	| { readonly _tag: "AlreadyThere"; readonly lemmaPath: string }
	| { readonly _tag: "Unplaced"; readonly reason: string };

export type ResetExecution = {
	readonly backupFolder: string;
	/** Per planned attestation, in the plan's order. */
	readonly regenerations: readonly (RegenerationResult | undefined)[];
	/** Per planned freeform Block, in the plan's order. */
	readonly freeform: readonly FreeformResult[];
	readonly cancelled: boolean;
	/** What Classify told the user while it ran: links it skipped and the like. */
	readonly notices: readonly string[];
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

export function countPlan(plan: ResetPlan): ResetCounts {
	const byKind: Record<OldNoteKind, number> = {
		Empty: 0,
		Entry: 0,
		FreeformOnly: 0,
		InflectionHost: 0,
		NewFormat: 0,
		Stub: 0,
	};
	const byMetaShape: Record<OldMetaShape, number> = {
		Entity: 0,
		LexicalMeta: 0,
		Unrecognized: 0,
	};
	for (const note of plan.collected.notes) {
		byKind[note.kind] += 1;
		for (const shape of note.metaShapes) byMetaShape[shape] += 1;
	}
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

/** Where an old note sits once it is backed up. */
const movedPath = (path: string, backupFolder: string | undefined) =>
	backupFolder === undefined
		? path
		: `${backupFolder}${path.slice("Worter".length)}`;

const cell = (text: string) => text.replace(/\|/gu, "\\|").replace(/\n/gu, " ");

export function renderReport(
	plan: ResetPlan,
	execution?: ResetExecution,
): string {
	const counts = countPlan(plan);
	const backup = execution?.backupFolder;
	const oldNote = (path: string, inTable = false) =>
		noteLink(movedPath(path, backup), inTable);
	const lines: string[] = [];
	lines.push(
		execution
			? `# Dictionary reset${execution.cancelled ? " (cancelled)" : ""}`
			: "# Dictionary reset: dry run",
		"",
	);
	if (execution)
		lines.push(
			`The old notes are in \`${execution.backupFolder}/\`. Nothing was deleted.`,
			"",
		);
	else
		lines.push(
			"Nothing was moved, written or asked of a provider. Execute would do the following.",
			"",
		);

	lines.push(
		"## Collected",
		"",
		`- Notes: ${counts.notes} (${Object.entries(counts.byKind)
			.filter(([, count]) => count > 0)
			.map(([kind, count]) => `${count} ${kind}`)
			.join(", ")})`,
		`- Metadata entries: ${counts.byMetaShape.LexicalMeta} lexicalMeta, ${counts.byMetaShape.Entity} entity, ${counts.byMetaShape.Unrecognized} unrecognized`,
		`- Attestation embeds: ${counts.attestations} (${counts.readyAttestations} to regenerate, ${counts.duplicateAttestations} duplicate, ${counts.unresolvableAttestations} unresolvable)`,
		`- Freeform Blocks: ${counts.freeformBlocks} (${counts.attachableFreeform} with a Lemma to regenerate, ${counts.unplaceableFreeform} without)`,
	);
	if (counts.otherFiles > 0)
		lines.push(`- Other files, kept in the backup: ${counts.otherFiles}`);
	const newFormat = plan.collected.notes.filter(
		({ kind }) => kind === "NewFormat",
	);
	if (newFormat.length > 0)
		lines.push(
			`- **Notes already in the new format, so Execute refuses to run:** ${newFormat.map(({ path }) => oldNote(path)).join(", ")}`,
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
				regenerated.set(result.lemmaPath, [
					...(regenerated.get(result.lemmaPath) ?? []),
					`${noteLink(result.scrollPath)} ^${planned.attestation.blockId} (${result.linked} linked)`,
				]);
		lines.push(`## Regenerated Lemmas (${regenerated.size})`, "");
		if (regenerated.size === 0) lines.push("None.");
		for (const [lemmaPath, from] of regenerated)
			lines.push(`- ${noteLink(lemmaPath)}, from ${from.join(", ")}`);
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
		lines.push("");
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
			`- \`${planned.attestation.embed}\` in ${oldNote(planned.notePath)} (${cell(planned.headword)}): ${reason}`,
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
				? `- From ${oldNote(planned.notePath)}, line ${planned.block.line}, to ${noteLink(result.lemmaPath)}${result._tag === "AlreadyThere" ? " (it was already there)" : ""}`
				: `- From ${oldNote(planned.notePath)}, line ${planned.block.line}, to the Lemma regenerated for "${planned.headword}"`,
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
		for (const notice of execution.notices) lines.push(`- ${notice}`);
		lines.push("");
	}
	return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}
