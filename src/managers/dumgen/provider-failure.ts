/**
 * Provider failures as one short line (#147): `OpenAI rejected the API key
 * (401 expired_secret_key)` rather than the provider's JSON body.
 *
 * dumgen's transports throw `<Provider> answered <status>: <body>`, with
 * the body cut at 200 characters, so the body is usually not valid JSON.
 * The error code is therefore read from the text itself, not decoded: the
 * first `"code"` (OpenAI) or `"error_type"` (TypeSafe) that holds a string.
 */

export type ProviderName = "OpenAI" | "TypeSafe";

/** dumgen's transports cut a refused answer's body at this many characters. */
const BODY_CAP = 200;

const CODE_PATTERNS = [
	/"code"\s*:\s*"([^"]+)"/u,
	/"error_type"\s*:\s*"([^"]+)"/u,
	/"type"\s*:\s*"([^"]+)"/u,
];

/** The provider's error code in a (possibly cut) JSON body, if it names one. */
export function errorCode(body: string): string | undefined {
	for (const pattern of CODE_PATTERNS) {
		const code = pattern.exec(body)?.[1];
		if (code !== undefined) return code;
	}
	return undefined;
}

/** What a provider's refusal means for the user, by HTTP status and code. */
function verb(status: number, code: string | undefined): string {
	if (status === 401) return "rejected the API key";
	if (status === 403) return "refused access with the API key";
	if (status === 429)
		return code === "insufficient_quota"
			? "has no quota left for the API key"
			: "rate-limited the request";
	if (status >= 500) return "failed on its side";
	return "refused the request";
}

/**
 * One provider answer as a line: `OpenAI rejected the API key (401
 * expired_secret_key)`.
 */
export function providerAnswerLine(
	provider: ProviderName,
	status: number,
	body: string,
): string {
	const code = errorCode(body);
	return `${provider} ${verb(status, code)} (${status}${code === undefined ? "" : ` ${code}`})`;
}

const ANSWERED = /(OpenAI|TypeSafe) answered (\d{3}): /gu;

/**
 * Where a body that starts `text` ends: at the first `; ` before which the
 * text is whole JSON, as when Classify joins several reasons, else after
 * the transport's cap.
 */
function bodyLength(text: string): number {
	const capped = text.slice(0, BODY_CAP);
	for (
		let at = capped.indexOf("; ");
		at !== -1;
		at = capped.indexOf("; ", at + 1)
	) {
		try {
			JSON.parse(capped.slice(0, at));
			return at;
		} catch {
			// Not the end of the body yet.
		}
	}
	return capped.length;
}

/**
 * A failure as one line: each `<Provider> answered <status>: <body>` in it
 * becomes its `providerAnswerLine`, and line breaks and runs of spaces
 * fold into single spaces.
 */
export function conciseFailure(text: string): string {
	const matches = [...text.matchAll(ANSWERED)];
	let out = "";
	let from = 0;
	for (const [index, match] of matches.entries()) {
		const [whole, provider, status] = match;
		const bodyStart = match.index + whole.length;
		const next = matches[index + 1]?.index ?? text.length;
		const length = bodyLength(text.slice(bodyStart, next));
		out += `${text.slice(from, match.index)}${providerAnswerLine(provider === "OpenAI" ? "OpenAI" : "TypeSafe", Number(status), text.slice(bodyStart, bodyStart + length))}`;
		from = bodyStart + length;
	}
	out += text.slice(from);
	return out.replace(/\s+/gu, " ").trim();
}
