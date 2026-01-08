import { reEscape } from "../../../../services/dto-services/text-utils";
import { type MetaInfo, MetaInfoSchema } from "../types";

const META_SECTION_ID = "textfresser_meta_keep_me_invisible";
const SECTION = "section";

export const META_INFO_FORMATTER = {
	make(meta: MetaInfo) {
		return `<${SECTION} id={${META_SECTION_ID}}>
${JSON.stringify(meta)}
</${SECTION}>\n` as const;
	},

	pattern: new RegExp(
		`<${SECTION}\\s+id=\\{${reEscape(META_SECTION_ID)}\\}>([\\s\\S]*?)<\\/${SECTION}>\\s*`,
	),

	schema: MetaInfoSchema,
} as const;
