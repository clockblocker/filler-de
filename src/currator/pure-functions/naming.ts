import {
  DASH,
  NON_BREAKING_HYPHEN,
  SPACE_LIKE_CHARS,
} from "../../types/beta/literals";

export const toGuardedNodeName = (name: string) => {
  let guardedName = name.replaceAll(NON_BREAKING_HYPHEN, DASH);

  // Build a regex for all space-likes
  const spaceLikeRegex = new RegExp(
    `[${SPACE_LIKE_CHARS.map((ch) => {
      // Escape regex special characters
      if (["\\", "-", "]", "[", "^"].includes(ch)) return "\\" + ch;
      // Unicode escapes
      if (ch.charCodeAt(0) > 0x7f)
        return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
      return ch;
    }).join("")}]`,
    "g",
  );

  guardedName = guardedName.replace(spaceLikeRegex, "_");

  return guardedName;
};
