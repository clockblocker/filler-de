/**
 * Line-based change representation compatible with Obsidian's editor.transaction().
 */
export type LineChange = {
	from: { line: number; ch: number };
	to?: { line: number; ch: number };
	text: string;
};

/**
 * Computes line-based changes to transform `before` into `after`.
 * Returns changes compatible with Obsidian's editor.transaction().
 *
 * This is a pure function - no editor/DOM dependencies.
 */
export function computeLineChanges(
	before: string,
	after: string,
): LineChange[] {
	if (before === after) return [];

	const oldLines = before.split("\n");
	const newLines = after.split("\n");

	const changes: LineChange[] = [];
	const maxLines = Math.max(oldLines.length, newLines.length);

	for (let i = 0; i < maxLines; i++) {
		const oldLine = oldLines[i] ?? "";
		const newLine = newLines[i];

		if (newLine === undefined) {
			// Lines deleted — replace from start of this line to end of doc
			changes.push({
				from: { ch: 0, line: i },
				text: "",
				to: {
					ch: oldLines[oldLines.length - 1]?.length ?? 0,
					line: oldLines.length - 1,
				},
			});
			break;
		}

		// Only replace existing lines in the loop; new lines are added by "Handle added lines at end"
		// (otherwise we double-apply when after has more lines than before, e.g. adding go-back link to empty file)
		if (i < oldLines.length && oldLine !== newLine) {
			changes.push({
				from: { ch: 0, line: i },
				text: newLine,
				to: { ch: oldLine.length, line: i },
			});
		}
	}

	// Handle added lines at end
	if (newLines.length > oldLines.length) {
		const lastOldLine = oldLines.length - 1;
		changes.push({
			from: {
				ch: oldLines[lastOldLine]?.length ?? 0,
				line: lastOldLine,
			},
			text: `\n${newLines.slice(oldLines.length).join("\n")}`,
		});
	}

	return changes;
}
