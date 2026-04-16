const ESCAPABLE_TOKEN_CHARS = /[%;,=-]/g;
const ESCAPED_DASH = "%2D";

export function escapeToken(value: string): string {
	return value.replace(ESCAPABLE_TOKEN_CHARS, (char) =>
		char === "-" ? ESCAPED_DASH : encodeURIComponent(char),
	);
}

export function unescapeToken(value: string): string {
	return decodeURIComponent(value);
}

export function serializeOptionalToken(value: string | undefined): string {
	return value === undefined ? "-" : escapeToken(value);
}

export function parseOptionalToken(token: string): string | undefined {
	return token === "-" ? undefined : unescapeToken(token);
}
