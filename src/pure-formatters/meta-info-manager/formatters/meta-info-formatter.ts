import { reEscape } from "../../text-utils";
import { type MetaInfo, MetaInfoSchema } from "../types";

const META_SECTION_ID = "textfresser_meta_keep_me_invisible";
const SECTION = "section";

export const META_INFO_FORMATTER = {
  make(meta: MetaInfo) {
    return `<${SECTION} id={${META_SECTION_ID}}>
${JSON.stringify(meta)}
</${SECTION}>` as const;
  },

  pattern: new RegExp(
    `<${SECTION}\\s+id=\\{${reEscape(META_SECTION_ID)}\\}>([\\s\\S]*?)<\\/${SECTION}>`,
  ),

  schema: MetaInfoSchema,
} as const;
