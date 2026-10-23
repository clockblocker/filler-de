/**
 * The plugin's dumgen: its operations with their services provided, over
 * one `DumgenLive` build (Dumgen ADR 0009).
 *
 * dumgen's operations are Effects that need `Jev` and `Luna`, and a host
 * provides `DumgenLive(options)` once per action. This adapter keeps the
 * plugin's consumers on the operations they ran before: `dumgenOver`
 * builds the Layer once, in `scope`, and hands each operation the services
 * of that one build. Every operation of one instance therefore shares one
 * request budget, as one `createDumgen` instance did. Providing
 * `DumgenLive` to each operation instead would build it, and so a fresh
 * budget of 16, on every call.
 *
 * It is the seam #222 replaces, when dumgen becomes a Layer of the plugin
 * runtime and consumers read `Jev | Luna` from their own requirements.
 */
import { DumgenLive, type Jev, type Luna, operations } from "dumgen";
import { Effect, Layer, Scope } from "effect";

/** What `DumgenLive` builds over: the transports, the budget, the trace sink. */
export type DumgenOptions = Parameters<typeof DumgenLive>[0];

type Operations = typeof operations;

/**
 * dumgen's operations over one build of `DumgenLive(options)`, made in
 * `scope` and released when it closes. The build is synchronous: every
 * transport the plugin uses is a sync Layer. A build Defect, such as a
 * floating `jevModel`, throws here, as `createDumgen` threw.
 *
 * A caller that never releases the build, such as a test, leaves `scope`
 * out and gets one of its own.
 */
export function dumgenOver(
	options: DumgenOptions,
	scope: Scope.Scope = Scope.makeUnsafe(),
) {
	const services = Effect.runSync(
		Layer.buildWithScope(DumgenLive(options), scope),
	);
	const provided = <A, E>(operation: Effect.Effect<A, E, Jev | Luna>) =>
		Effect.provideContext(operation, services);
	return {
		knowledge: {
			accumulateTranslations: (
				input: Parameters<
					Operations["knowledge"]["accumulateTranslations"]
				>[0],
			) => provided(operations.knowledge.accumulateTranslations(input)),
			produce: <E = never>(
				input: Parameters<typeof operations.knowledge.produce<E>>[0],
			) => provided(operations.knowledge.produce(input)),
		},
		language: {
			detect: (input: Parameters<Operations["language"]["detect"]>[0]) =>
				provided(operations.language.detect(input)),
		},
		resolve: {
			grammar: (input: Parameters<Operations["resolve"]["grammar"]>[0]) =>
				provided(operations.resolve.grammar(input)),
			reading: (input: Parameters<Operations["resolve"]["reading"]>[0]) =>
				provided(operations.resolve.reading(input)),
		},
		segment: {
			inUnits: (input: Parameters<Operations["segment"]["inUnits"]>[0]) =>
				provided(operations.segment.inUnits(input)),
		},
		translate: {
			sentence: (
				input: Parameters<Operations["translate"]["sentence"]>[0],
			) => provided(operations.translate.sentence(input)),
		},
	};
}

/** The plugin's dumgen: what `dumgenOver` returns. */
export type Dumgen = ReturnType<typeof dumgenOver>;
