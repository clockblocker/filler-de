export const ENTRY_SEPARATOR = "\n\n---\n---\n\n";

/** Splits on both old (`\n---\n---\n---\n`) and new (`\n\n---\n---\n\n`) separators. */
export const ENTRY_SEPARATOR_RE = /\n+---\n---(?:\n---)*\n+/;

/** Legacy CSS class name — parsed as-is from note markup */
export const ENTRY_SECTION_CSS_CLASS = "entry_section_title";

/** Matches `<span class="entry_section_title entry_section_title_<kind>">Title</span>` */
export const ENTRY_SECTION_MARKER_RE =
	/<span class="entry_section_title entry_section_title_(\w+)">([^<]+)<\/span>/g;
