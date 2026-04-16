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

export function joinTokens(parts: readonly string[]): string {
	return parts.join(";");
}

export function splitLeadingTokens(
	body: string,
	partCount: number,
	label: string,
): string[] {
	const parts: string[] = [];
	let remainder = body;

	for (let index = 0; index < partCount - 1; index += 1) {
		const separatorIndex = remainder.indexOf(";");

		if (separatorIndex === -1) {
			throw new Error(`Malformed ${label} payload in Ling ID: ${body}`);
		}

		parts.push(remainder.slice(0, separatorIndex));
		remainder = remainder.slice(separatorIndex + 1);
	}

	parts.push(remainder);

	return parts;
}
