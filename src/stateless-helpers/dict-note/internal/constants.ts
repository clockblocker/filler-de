export const ENTRY_SEPARATOR = "\n---\n---\n---\n";

/** Legacy CSS class name — parsed as-is from note markup */
export const ENTRY_SECTION_CSS_CLASS = "note_block_title";

/** Matches `<span class="note_block_title note_block_title_<kind>">Title</span>` */
export const ENTRY_SECTION_MARKER_RE =
	/<span class="note_block_title note_block_title_(\w+)">([^<]+)<\/span>/g;
