/**
 * Language-specific configuration for text segmentation.
 */
export type LanguageConfig = {
	/** Locale for Intl.Segmenter */
	locale: string;
	/** Quote mark definitions */
	quotes: {
		/** Characters that open quotes (increase depth) */
		opening: string[];
		/** Characters that close quotes (decrease depth) */
		closing: string[];
		/** Characters that toggle (ASCII neutral quotes) */
		neutral: string[];
	};
	/** Poem detection patterns */
	poemIndicators: {
		/** Line patterns indicating poetry (e.g., markdown line break) */
		linePatterns: RegExp[];
		/** Structure patterns (e.g., short lines) */
		maxLineLength: number;
	};
};

/**
 * German language configuration.
 * Quote marks:
 * - U+201E „ (DOUBLE LOW-9 QUOTATION MARK) - German opening
 * - U+00BB » (RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK) - French/German opening
 * - U+201D " (RIGHT DOUBLE QUOTATION MARK) - German closing
 * - U+00AB « (LEFT-POINTING DOUBLE ANGLE QUOTATION MARK) - French/German closing
 * - U+0022 " (QUOTATION MARK) - ASCII neutral
 */
export const GERMAN_CONFIG: LanguageConfig = {
	locale: "de",
	poemIndicators: {
		linePatterns: [/ {2}$/], // Markdown line break
		maxLineLength: 60, // Lines under this might be verse
	},
	quotes: {
		// U+201D RIGHT DOUBLE QUOTATION MARK, U+00AB LEFT-POINTING DOUBLE ANGLE
		closing: ["\u201D", "\u00AB"],
		// U+0022 ASCII neutral quote
		neutral: ["\u0022"],
		// U+201E DOUBLE LOW-9 QUOTATION MARK, U+00BB RIGHT-POINTING DOUBLE ANGLE
		opening: ["\u201E", "\u00BB"],
	},
};

/**
 * English language configuration (for future use).
 */
export const ENGLISH_CONFIG: LanguageConfig = {
	locale: "en",
	poemIndicators: {
		linePatterns: [/ {2}$/],
		maxLineLength: 60,
	},
	quotes: {
		// U+201D RIGHT DOUBLE QUOTATION MARK, U+2019 RIGHT SINGLE QUOTATION MARK
		closing: ["\u201D", "\u2019"],
		// U+0022 ASCII double quote, U+0027 ASCII single quote
		neutral: ["\u0022", "\u0027"],
		// U+201C LEFT DOUBLE QUOTATION MARK, U+2018 LEFT SINGLE QUOTATION MARK
		opening: ["\u201C", "\u2018"],
	},
};

/**
 * Default configuration.
 */
export const DEFAULT_LANGUAGE_CONFIG = GERMAN_CONFIG;
