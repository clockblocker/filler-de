import { Effect } from "effect";
import type { EffectRunner } from "../../src/runtime/plugin-runtime";

/** Runs the hops on Effect's default runtime, for tests with no plugin runtime. */
export const defaultRunner: EffectRunner = {
	runFork: (effect) => Effect.runFork(effect),
	runPromise: (effect) => Effect.runPromise(effect),
	runPromiseExit: (effect) => Effect.runPromiseExit(effect),
};
