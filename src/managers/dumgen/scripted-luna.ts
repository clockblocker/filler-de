/**
 * A Luna that answers from a script instead of the OpenAI API, for runs
 * that must never reach a provider: desktop E2E and in-process tests.
 *
 * The script maps a Luna stage (`canonical`, `emojiDescription`, a
 * Knowledge aspect's stage, …) to rules. A rule answers when its `when`
 * text occurs in the request's JSON input, or always without one; the
 * first matching rule wins. A request no rule answers is refused, which
 * dumgen reports as a `ProviderFailure`.
 */
import type { LunaAsk } from "dumgen";

export type ScriptedLunaRule = {
	/** Text the request's JSON input must contain; any request without it. */
	readonly when?: string;
	readonly output: unknown;
};

export type ScriptedLunaAnswers = Readonly<
	Record<string, readonly ScriptedLunaRule[]>
>;

export function createScriptedLuna(answers: ScriptedLunaAnswers = {}): {
	readonly ask: LunaAsk;
	/** How many requests it received, by stage, answered or not. */
	readonly requests: () => Readonly<Record<string, number>>;
} {
	const requests: Record<string, number> = {};
	const ask: LunaAsk = async (request, { stage }) => {
		requests[stage] = (requests[stage] ?? 0) + 1;
		const input = JSON.stringify(request.input);
		const rule = (answers[stage] ?? []).find(
			({ when }) => when === undefined || input.includes(when),
		);
		if (!rule)
			throw new Error(`The scripted Luna has no answer for ${stage}`);
		return { output: structuredClone(rule.output) };
	};
	return { ask, requests: () => ({ ...requests }) };
}
