import { LINE_BREAK } from "../../../services/dto-services/note-block-manager/note-block-management/types-and-constants";
import { META_INFO_FORMATTER } from "./formatters/meta-info-formatter";
import type { MetaInfo } from "./types";

/** @deprecated */
export function extractMetaInfoDeprecated(str: string): MetaInfo | null {
	const match = str.match(META_INFO_FORMATTER.pattern);
	if (!match) return null;

	const jsonStr = match[1]?.trim();

	const parsed = META_INFO_FORMATTER.schema.safeParse(
		JSON.parse(jsonStr ?? ""),
	);
	return parsed.success ? parsed.data : null;
}

/** @deprecated */
export function editOrAddMetaInfoDeprecated(
	str: string,
	meta: MetaInfo,
): string {
	const metaSection = META_INFO_FORMATTER.make(meta);

	let contentWithoutMeta = str
		.replace(META_INFO_FORMATTER.pattern, "")
		.trimEnd();

	// Always ensure a line break before the meta section if content is not empty
	if (
		contentWithoutMeta.length > 0 &&
		!contentWithoutMeta.endsWith(LINE_BREAK)
	) {
		contentWithoutMeta += LINE_BREAK;
	}

	return contentWithoutMeta + LINE_BREAK + metaSection;
}
