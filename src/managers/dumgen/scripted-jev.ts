/**
 * A jev that answers from a script instead of the TypeSafe API, for runs
 * that must never reach a provider: desktop E2E and in-process tests. It
 * answers a question by its id from `answers`; any other Noul gets 0.1, a
 * Choice offering `German` picks it, any other Choice its last option, and
 * a Score its lowest score.
 */
import type { Answer, JevAsk } from "dumgen";

export type ScriptedJevAnswers = Readonly<Record<string, Answer>>;

const picked = (choice: string): Answer => ({
	choice,
	confidence: 1,
	probabilities: { [choice]: 1 },
	type: "choice",
});

export function createScriptedJev(answers: ScriptedJevAnswers = {}): {
	readonly ask: JevAsk;
	/** How many requests it answered, by stage. */
	readonly requests: () => Readonly<Record<string, number>>;
} {
	const requests: Record<string, number> = {};
	const ask: JevAsk = async (request, { stage }) => {
		requests[stage] = (requests[stage] ?? 0) + 1;
		const answered: Record<string, Answer> = {};
		for (const [id, question] of Object.entries(request.questions)) {
			const scripted = answers[id];
			if (scripted) answered[id] = scripted;
			else if (question.type === "noul")
				answered[id] = { noul: 0.1, type: "noul" };
			else if (question.type === "score")
				answered[id] = {
					confidence: 1,
					probabilities: { 0: 1 },
					score: 0,
					type: "score",
				};
			else {
				const options = Object.keys(question.criteria);
				answered[id] = picked(
					options.includes("German")
						? "German"
						: (options.at(-1) ?? ""),
				);
			}
		}
		return {
			answers: answered,
			model: request.model,
			usage: {
				input_tokens: 10 * Object.keys(request.questions).length,
				output_tokens: 1,
			},
		};
	};
	return { ask, requests: () => ({ ...requests }) };
}
