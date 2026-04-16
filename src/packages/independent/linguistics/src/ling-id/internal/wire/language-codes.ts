import type { TargetLanguage } from "../../../lu/universal/enums/core/language";

const LANGUAGE_TO_CODE = {
	English: "EN",
	German: "DE",
	Hebrew: "HE",
} as const satisfies Record<TargetLanguage, string>;

const CODE_TO_LANGUAGE = {
	DE: "German",
	EN: "English",
	HE: "Hebrew",
} as const satisfies Record<string, TargetLanguage>;

export function languageToCode(language: TargetLanguage): string {
	return LANGUAGE_TO_CODE[language];
}

export function codeToLanguage(code: string): TargetLanguage | undefined {
	return (CODE_TO_LANGUAGE as Record<string, TargetLanguage | undefined>)[
		code
	];
}
