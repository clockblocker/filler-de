import type { LunaAsk } from "dumgen";
import type { DumgenProvide } from "../../../../src/managers/dumgen";
import { provideFakes } from "../../dumgen/dumgen-support";

/**
 * A dumgen whose Luna answers every request with `answer`'s output,
 * recording each request's input; jev refuses every request.
 */
export function stubLuna(answer: () => unknown): {
	readonly dumgen: DumgenProvide;
	readonly inputs: unknown[];
} {
	const inputs: unknown[] = [];
	const ask: LunaAsk = (request) => {
		inputs.push(request.input);
		return Promise.resolve({ output: answer() } as Awaited<
			ReturnType<LunaAsk>
		>);
	};
	return { dumgen: provideFakes({ luna: ask }), inputs };
}
