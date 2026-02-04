/**
 * Markdown Protector
 *
 * Protects markdown syntax that confuses Intl.Segmenter from being
 * incorrectly split on punctuation (`.`, `?`, `!`).
 *
 * Strategy: Replace "unsafe" content with placeholder tokens before
 * segmentation, then restore after.
 *
 * Protected patterns:
 * - Fenced code blocks (```...```)
 * - URLs (https://... or http://...)
 * - Horizontal rules (---, ***, ___)
 * - Wikilinks ([[...]])
 * - Markdown links ([text](url))
 */

/**
 * Object Replacement Character - used as delimiter for placeholders.
 * This character won't appear in normal text.
 */
const PLACEHOLDER_CHAR = "\uFFFC";

/**
 * Information about a protected piece of content.
 */
export type ProtectedContent = {
	/** The placeholder string (e.g., "\uFFFCURL0\uFFFC") */
	placeholder: string;
	/** The original content that was replaced */
	original: string;
	/** Character position in original text where this content started */
	startOffset: number;
};

/**
 * Result of protecting markdown syntax.
 */
export type ProtectionResult = {
	/** Text with placeholders substituted for protected content */
	safeText: string;
	/** List of protected items for later restoration */
	protectedItems: ProtectedContent[];
};

/**
 * Pattern definitions with their tag prefixes.
 * Order matters: fenced code blocks first (most greedy), then others.
 */
const PATTERNS: { regex: RegExp; tag: string }[] = [
	// Fenced code blocks (multiline) - must come first
	{ regex: /```[\s\S]*?```/g, tag: "CB" },
	// URLs - match http/https, stop at whitespace, closing brackets, or angle brackets
	// Handle parentheses: allow balanced parens (common in Wikipedia URLs)
	// The pattern allows one level of balanced parens anywhere in the URL
	{
		regex: /https?:\/\/(?:[^\s\])<>\n()]|\([^\s\])<>\n()]*\))+/g,
		tag: "URL",
	},
	// Horizontal rules: 3+ of -, *, or _ on their own line
	{ regex: /^[-*_]{3,}\s*$/gm, tag: "HR" },
	// Wikilinks: [[...]] - non-greedy to handle [[a]] [[b]]
	{ regex: /\[\[[^\]]+\]\]/g, tag: "WL" },
	// Markdown links: [text](url) - non-greedy
	{ regex: /\[[^\]]+\]\([^)]+\)/g, tag: "ML" },
];

/**
 * Protects markdown syntax by replacing it with placeholders.
 *
 * @param text - The original markdown text
 * @returns Protected text and list of protected items
 */
export function protectMarkdownSyntax(text: string): ProtectionResult {
	const protectedItems: ProtectedContent[] = [];
	let safeText = text;
	let indexCounter = 0;

	// Track offset adjustments as we replace content
	// Each replacement may change the length, so we need to track cumulative shift
	let offsetShift = 0;

	// Collect all matches first, then sort by position to process in order
	type Match = {
		tag: string;
		original: string;
		start: number;
		end: number;
	};
	const allMatches: Match[] = [];

	for (const { regex, tag } of PATTERNS) {
		// Reset lastIndex for global regexes
		regex.lastIndex = 0;
		let match = regex.exec(text);
		while (match !== null) {
			allMatches.push({
				end: match.index + match[0].length,
				original: match[0],
				start: match.index,
				tag,
			});
			match = regex.exec(text);
		}
	}

	// Sort by start position (ascending)
	allMatches.sort((a, b) => a.start - b.start);

	// Filter out overlapping matches (keep first/longer one)
	const filteredMatches: Match[] = [];
	let lastEnd = -1;
	for (const m of allMatches) {
		if (m.start >= lastEnd) {
			filteredMatches.push(m);
			lastEnd = m.end;
		}
	}

	// Process matches in order, tracking offset shifts
	for (const m of filteredMatches) {
		const placeholder = `${PLACEHOLDER_CHAR}${m.tag}${indexCounter}${PLACEHOLDER_CHAR}`;
		indexCounter++;

		// Calculate position in current safeText (adjusted for previous replacements)
		const adjustedStart = m.start + offsetShift;
		const adjustedEnd = m.end + offsetShift;

		// Replace in safeText
		safeText =
			safeText.slice(0, adjustedStart) +
			placeholder +
			safeText.slice(adjustedEnd);

		// Track the protected item with original offset
		protectedItems.push({
			original: m.original,
			placeholder,
			startOffset: m.start,
		});

		// Update offset shift for subsequent replacements
		offsetShift += placeholder.length - m.original.length;
	}

	return { protectedItems, safeText };
}

/**
 * Restores protected content from placeholders.
 *
 * @param text - Text containing placeholders
 * @param items - List of protected items to restore
 * @returns Text with original content restored
 */
export function restoreProtectedContent(
	text: string,
	items: ProtectedContent[],
): string {
	let result = text;

	// Replace each placeholder with its original content
	for (const item of items) {
		result = result.replace(item.placeholder, item.original);
	}

	return result;
}
