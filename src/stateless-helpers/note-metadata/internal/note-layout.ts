/**
 * A note as the facility sees it: optional frontmatter, the visible body,
 * and an optional hidden section that ends the file.
 */

import {
	isEmptyDocument,
	type MetadataDocument,
	sameDocument,
} from "./document";
import {
	formatFrontmatter,
	type LocatedFrontmatter,
	locateFrontmatter,
} from "./frontmatter";
import {
	formatHiddenSection,
	HIDDEN_SECTION_PADDING,
	type LocatedHiddenSection,
	locateHiddenSection,
} from "./hidden-section";

export type NoteLayout = {
	readonly frontmatter: LocatedFrontmatter | null;
	/** Everything between the frontmatter and the hidden section, as is. */
	readonly body: string;
	readonly hidden: LocatedHiddenSection | null;
};

export function splitNote(content: string): NoteLayout {
	const frontmatter = locateFrontmatter(content);
	const bodyStart = frontmatter?.end ?? 0;
	const located = locateHiddenSection(content);
	const hidden = located && located.start >= bodyStart ? located : null;
	return {
		body: content.slice(bodyStart, hidden?.start ?? content.length),
		frontmatter,
		hidden,
	};
}

export type NoteEdit = {
	/** The new frontmatter mapping; null keeps the block as it is. */
	readonly frontmatter: MetadataDocument | null;
	readonly body: string;
	/** The new hidden-section document; null or empty drops the section. */
	readonly hidden: MetadataDocument | null;
};

/**
 * Writes `edit` over `layout`. The output is canonical, so writing it again
 * gives the same bytes:
 * - a frontmatter block whose mapping did not change is kept byte for byte;
 *   otherwise it is rewritten, and dropped when its mapping became empty;
 * - with a hidden section, the body's trailing whitespace is replaced by the
 *   fixed padding, so no pass can grow it;
 * - when the section is dropped, the body keeps one final newline.
 */
export function joinNote(layout: NoteLayout, edit: NoteEdit): string {
	const frontmatter = renderFrontmatter(layout.frontmatter, edit.frontmatter);
	if (edit.hidden && !isEmptyDocument(edit.hidden)) {
		return `${frontmatter}${edit.body.trimEnd()}${HIDDEN_SECTION_PADDING}${formatHiddenSection(edit.hidden)}\n`;
	}
	if (!layout.hidden) return `${frontmatter}${edit.body}`;
	const body = edit.body.trimEnd();
	return `${frontmatter}${body}${body ? "\n" : ""}`;
}

function renderFrontmatter(
	located: LocatedFrontmatter | null,
	next: MetadataDocument | null,
): string {
	if (next === null) return located?.raw ?? "";
	if (located?.document && sameDocument(located.document, next)) {
		return located.raw;
	}
	if (!located && isEmptyDocument(next)) return "";
	return formatFrontmatter(next);
}
