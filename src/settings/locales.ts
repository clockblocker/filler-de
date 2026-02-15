import type { KnownLanguage, SelectionActionPlacement } from "../types";

export type SettingsLocale = {
	// Headings
	apiKeyHeading: string;
	languagesHeading: string;
	libraryHeading: string;
	actionsHeading: string;

	// Setting names
	geminiApiKey: string;
	apiProvider: string;
	knownLanguage: string;
	targetLanguage: string;
	libraryRoot: string;
	maxSectionDepth: string;
	showScrollsDepth: string;
	suffixDelimiter: string;
	wrapDelimiter: string;
	showBacklinks: string;
	hideMetadata: string;
	navButtonsPosition: string;

	// Setting descriptions
	geminiApiKeyDesc: string;
	apiProviderDesc: string;
	knownLanguageDesc: string;
	targetLanguageDesc: string;
	libraryRootDesc: string;
	maxSectionDepthDesc: string;
	showScrollsDepthDesc: string;
	suffixDelimiterDesc: string;
	wrapDelimiterDesc: string;
	showBacklinksDesc: string;
	hideMetadataDesc: string;
	navButtonsPositionDesc: string;
	actionPlacementDesc: (label: string) => string;

	// Placeholders
	apiKeyPlaceholder: string;
	libraryRootPlaceholder: string;
	suffixDelimiterPlaceholder: string;

	// Dropdown options
	navButtonsLeft: string;
	navButtonsRight: string;
	placementText: Record<SelectionActionPlacement, string>;

	// Action labels (keyed by CommandKind)
	actionLabels: Record<string, string>;

	// Validation messages
	delimiterLengthError: string;
	delimiterSpacesError: string;
	delimiterForbiddenCharError: (char: string) => string;
};

const ENGLISH_LOCALE: SettingsLocale = {
	// Action labels
	actionLabels: {
		Generate: "Generate",
		SplitInBlocks: "Split in Blocks",
		TranslateSelection: "Translate",
	},
	actionPlacementDesc: (label: string) => `Where to show the ${label} action`,
	actionsHeading: "Actions",
	// Headings
	apiKeyHeading: "API key",

	// Placeholders
	apiKeyPlaceholder: "Enter your API key",
	apiProvider: "API provider",
	apiProviderDesc: "Choose your API provider",
	delimiterForbiddenCharError: (char: string) =>
		`Cannot use "${char}" in delimiter (forbidden character)`,

	// Validation messages
	delimiterLengthError: "Suffix delimiter symbol must be 1-3 characters",
	delimiterSpacesError: "Suffix delimiter symbol cannot contain spaces",

	// Setting names
	geminiApiKey: "Gemini API key",

	// Setting descriptions
	geminiApiKeyDesc: "Enter your Gemini API key",
	hideMetadata: "Hide metadata",
	hideMetadataDesc:
		"Store metadata invisibly at end of file. When off, uses YAML frontmatter.",
	knownLanguage: "Language you know",
	knownLanguageDesc: "Your native or known language for translations",
	languagesHeading: "Languages",
	libraryHeading: "Library",
	libraryRoot: "Library root folder",
	libraryRootDesc: "The folder containing your library of texts",
	libraryRootPlaceholder: "Library",
	maxSectionDepth: "Max section depth",
	maxSectionDepthDesc:
		"Maximum nesting depth for sections in codexes (1-10). Higher = more nested sections.",

	// Dropdown options
	navButtonsLeft: "Left",
	navButtonsPosition: "Navigation buttons position",
	navButtonsPositionDesc:
		"Where to show navigation buttons (← →) in the bottom toolbar",
	navButtonsRight: "Right",
	placementText: {
		AboveSelection: "Above selection",
		Bottom: "In bottom toolbar",
		ShortcutOnly: "Shortcut only",
	},
	showBacklinks: "Show backlinks on scrolls",
	showBacklinksDesc: "Add go-back links at the top of scroll files",
	showScrollsDepth: "Show scrolls in codexes for depth",
	showScrollsDepthDesc:
		"Depth at which scrolls (leaf documents) appear in codexes (0-10). 0 = only top level.",
	suffixDelimiter: "Suffix delimiter symbol",
	suffixDelimiterDesc:
		"1-3 characters used to separate base name from suffix (no spaces)",
	suffixDelimiterPlaceholder: "-",
	targetLanguage: "Language to learn",
	targetLanguageDesc: "The language you are studying",
	wrapDelimiter: "Wrap delimiter in spaces",
	wrapDelimiterDesc: "Use ' - ' instead of '-' as delimiter",
};

const RUSSIAN_LOCALE: SettingsLocale = {
	// Action labels
	actionLabels: {
		Generate: "Сгенерировать",
		SplitInBlocks: "Разбить на блоки",
		TranslateSelection: "Перевести",
	},
	actionPlacementDesc: (label: string) => `Где показывать действие ${label}`,
	actionsHeading: "Действия",
	// Headings
	apiKeyHeading: "API ключ",

	// Placeholders
	apiKeyPlaceholder: "Введите ваш API ключ",
	apiProvider: "Провайдер API",
	apiProviderDesc: "Выберите провайдера API",
	delimiterForbiddenCharError: (char: string) =>
		`Нельзя использовать "${char}" в разделителе (запрещённый символ)`,

	// Validation messages
	delimiterLengthError: "Символ разделителя должен быть 1-3 символа",
	delimiterSpacesError: "Символ разделителя не может содержать пробелы",

	// Setting names
	geminiApiKey: "Ключ Gemini API",

	// Setting descriptions
	geminiApiKeyDesc: "Введите ваш ключ Gemini API",
	hideMetadata: "Скрыть метаданные",
	hideMetadataDesc:
		"Хранить метаданные невидимо в конце файла. Если выкл., использует YAML frontmatter.",
	knownLanguage: "Язык, который вы знаете",
	knownLanguageDesc: "Ваш родной язык для переводов",
	languagesHeading: "Языки",
	libraryHeading: "Библиотека",
	libraryRoot: "Корневая папка библиотеки",
	libraryRootDesc: "Папка с вашей библиотекой текстов",
	libraryRootPlaceholder: "Библиотека",
	maxSectionDepth: "Макс. глубина разделов",
	maxSectionDepthDesc:
		"Максимальная глубина вложенности разделов в кодексах (1-10). Больше = больше вложенности.",

	// Dropdown options
	navButtonsLeft: "Слева",
	navButtonsPosition: "Позиция кнопок навигации",
	navButtonsPositionDesc:
		"Где показывать кнопки навигации (← →) в нижней панели",
	navButtonsRight: "Справа",
	placementText: {
		AboveSelection: "Над выделением",
		Bottom: "В нижней панели",
		ShortcutOnly: "Только горячие клавиши",
	},
	showBacklinks: "Показывать обратные ссылки",
	showBacklinksDesc: "Добавить ссылки назад вверху файлов свитков",
	showScrollsDepth: "Показывать свитки на глубине",
	showScrollsDepthDesc:
		"Глубина на которой свитки появляются в кодексах (0-10). 0 = только верхний уровень.",
	suffixDelimiter: "Символ разделителя суффикса",
	suffixDelimiterDesc:
		"1-3 символа для разделения базового имени от суффикса (без пробелов)",
	suffixDelimiterPlaceholder: "-",
	targetLanguage: "Изучаемый язык",
	targetLanguageDesc: "Язык, который вы изучаете",
	wrapDelimiter: "Обернуть разделитель пробелами",
	wrapDelimiterDesc: "Использовать ' - ' вместо '-' как разделитель",
};

export const LOCALES: Record<KnownLanguage, SettingsLocale> = {
	English: ENGLISH_LOCALE,
	Russian: RUSSIAN_LOCALE,
};
