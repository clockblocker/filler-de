import { z } from "zod";

// Format
const SlashSchema = z.literal("/");
export type SLASH = z.infer<typeof SlashSchema>;
export const SLASH = SlashSchema.value;

const BirdSchema = z.literal("^");
export type BIRD = z.infer<typeof BirdSchema>;
export const BIRD = BirdSchema.value;

const SpaceFormatSchema = z.literal(" ");
export type SPACE_F = z.infer<typeof SpaceFormatSchema>;
export const SPACE_F = SpaceFormatSchema.value;

const TabSchema = z.literal("\t");
export type TAB = z.infer<typeof TabSchema>;
export const TAB = TabSchema.value;

const LineBreakSchema = z.literal("\n");
export type LINE_BREAK = z.infer<typeof LineBreakSchema>;
export const LINE_BREAK = LineBreakSchema.value;

const StarSchema = z.literal("*");
export type STAR = z.infer<typeof StarSchema>;
export const STAR = StarSchema.value;

const BackArrowSchema = z.literal("←");
export type BACK_ARROW = z.infer<typeof BackArrowSchema>;
export const BACK_ARROW = BackArrowSchema.value;

const ForwardArrowSchema = z.literal("→");
export type FORWARD_ARROW = z.infer<typeof ForwardArrowSchema>;
export const FORWARD_ARROW = ForwardArrowSchema.value;

const ObsidianLinkOpenSchema = z.literal("[[");
export type OBSIDIAN_LINK_OPEN = z.infer<typeof ObsidianLinkOpenSchema>;
export const OBSIDIAN_LINK_OPEN = ObsidianLinkOpenSchema.value;

const ObsidianLinkCloseSchema = z.literal("]]");
export type OBSIDIAN_LINK_CLOSE = z.infer<typeof ObsidianLinkCloseSchema>;
export const OBSIDIAN_LINK_CLOSE = ObsidianLinkCloseSchema.value;

const DoneCheckboxSchema = z.literal("- [x]");
export type DONE_CHECKBOX = z.infer<typeof DoneCheckboxSchema>;
export const DONE_CHECKBOX = DoneCheckboxSchema.value;

const NotStartedCheckboxSchema = z.literal("- [ ]");
export type NOT_STARTED_CHECKBOX = z.infer<typeof NotStartedCheckboxSchema>;
export const NOT_STARTED_CHECKBOX = NotStartedCheckboxSchema.value;

export const CheckboxSchema = z.union([
	z.literal(DONE_CHECKBOX),
	z.literal(NOT_STARTED_CHECKBOX),
]);
export type CHECKBOX = z.infer<typeof CheckboxSchema>;

const PipeSchema = z.literal("|");
export type PIPE = z.infer<typeof PipeSchema>;
export const PIPE = PipeSchema.value;

const HashSchema = z.literal("#");
export type HASH = z.infer<typeof HashSchema>;
export const HASH = HashSchema.value;

const LongDashSchema = z.literal("—");
export type LONG_DASH = z.infer<typeof LongDashSchema>;
export const LONG_DASH = LongDashSchema.value;

export const SmallEmDashSchema = z.literal("﹘");
export type SMALL_EM_DASH = z.infer<typeof SmallEmDashSchema>;
export const SMALL_EM_DASH = SmallEmDashSchema.value;

const DashSchema = z.literal("-");
export type DASH = z.infer<typeof DashSchema>;
export const DASH = DashSchema.value;

const NonBreakingHyphenSchema = z.literal("‑");
export type NON_BREAKING_HYPHEN = z.infer<typeof NonBreakingHyphenSchema>;
export const NON_BREAKING_HYPHEN = NonBreakingHyphenSchema.value;

export const UnderscoreSchema = z.literal("_");
export type UNDERSCORE = z.infer<typeof UnderscoreSchema>;
export const UNDERSCORE = UnderscoreSchema.value;

const PlusDelimeterSchema = z.literal(`${UNDERSCORE}plus${UNDERSCORE}`); // _plus_
export type PLUS_DELIMETER = z.infer<typeof PlusDelimeterSchema>;
export const PLUS_DELIMETER = PlusDelimeterSchema.value;

export const SPACE_LIKE_CHARS = [
	" ", // space
	"\u00A0", // non-breaking space
	"\t", // tab
	"\n", // new line
	"\r", // carriage return
	"\v", // vertical tab
	"\f", // form feed
	"\u1680", // OGHAM SPACE MARK
	"\u180E", // MONGOLIAN VOWEL SEPARATOR
	"\u2000", // EN QUAD
	"\u2001", // EM QUAD
	"\u2002", // EN SPACE
	"\u2003", // EM SPACE
	"\u2004", // THREE-PER-EM SPACE
	"\u2005", // FOUR-PER-EM SPACE
	"\u2006", // SIX-PER-EM SPACE
	"\u2007", // FIGURE SPACE
	"\u2008", // PUNCTUATION SPACE
	"\u2009", // THIN SPACE
	"\u200A", // HAIR SPACE
	"\u2028", // LINE SEPARATOR
	"\u2029", // PARAGRAPH SEPARATOR
	"\u202F", // NARROW NO-BREAK SPACE
	"\u205F", // MEDIUM MATHEMATICAL SPACE
	"\u3000", // IDEOGRAPHIC SPACE
] as const;
