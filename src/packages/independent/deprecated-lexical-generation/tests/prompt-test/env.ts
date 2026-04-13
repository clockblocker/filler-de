export function getGeminiApiKey(
	env: Record<string, string | undefined> = process.env,
): string {
	const apiKey = env.GEMINI_API_KEY?.trim();

	if (!apiKey) {
		throw new Error("Missing GEMINI_API_KEY environment variable");
	}

	return apiKey;
}

export function hasGeminiApiKey(
	env: Record<string, string | undefined> = process.env,
): boolean {
	return Boolean(env.GEMINI_API_KEY?.trim());
}
