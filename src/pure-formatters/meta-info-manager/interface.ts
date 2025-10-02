import { LINE_BREAK } from '../note-block-manager/note-block-management/types-and-constants';
import { META_INFO_FORMATTER } from './formatters/meta-info-formatter';
import { MetaInfo } from './types';

/**
 * Extracts the MetaInfo object from a string containing a special section.
 * The section is expected to look like:
 * <section id={textfresser_meta_keep_me_invisible}>
 * {
 *   "fileType": "Text"
 * }
 * </section>
 *
 * If no such section is found, returns null.
 */
export function extractMetaInfo(str: string): MetaInfo | null {
	const match = str.match(META_INFO_FORMATTER.pattern);
	if (!match) return null;

	const jsonStr = match[1].trim();

	const parsed = META_INFO_FORMATTER.schema.safeParse(JSON.parse(jsonStr));
	return parsed.success ? parsed.data : null;
}

export function editOrAddMetaInfo(str: string, meta: MetaInfo): string {
	const metaSection = META_INFO_FORMATTER.make(meta);

	if (META_INFO_FORMATTER.pattern.test(str)) {
		// Replace the existing meta section
		return str.replace(META_INFO_FORMATTER.pattern, metaSection);
	} else {
		// Add the meta section at the top
		return str + LINE_BREAK + metaSection;
	}
}
