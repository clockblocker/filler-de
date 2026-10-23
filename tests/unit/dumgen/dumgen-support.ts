import {
	DumgenLive,
	type JevAsk,
	JevTransport,
	type LunaAsk,
	LunaTransport,
} from "dumgen";
import { Effect, Layer } from "effect";
import {
	Dumgen,
	type DumgenProvide,
	type DumgenProviderKeys,
	HttpTransport,
	ProviderKeys,
	type RequestUrl,
} from "../../../src/managers/dumgen";

const refusing =
	(executor: string) =>
	(): Promise<never> =>
		Promise.reject(new Error(`${executor} was not expected`));

/**
 * `DumgenLive` over fakes, plain async functions provided as transports
 * (Dumgen ADR 0009); a provider without one refuses every request.
 */
export function fakeDumgen(
	fakes: {
		readonly jev?: JevAsk;
		readonly luna?: LunaAsk;
		readonly requestBudget?: number;
	} = {},
) {
	return DumgenLive({
		jev: JevTransport.fromAsk(fakes.jev ?? refusing("jev")),
		luna: LunaTransport.fromAsk(fakes.luna ?? refusing("Luna")),
		...(fakes.requestBudget === undefined
			? {}
			: { requestBudget: fakes.requestBudget }),
	});
}

/** The plugin's `Dumgen` service over a stubbed `requestUrl` and keys. */
export function dumgenLayerOver(
	requestUrl: RequestUrl,
	keys: () => DumgenProviderKeys = () => ({
		openaiApiKey: "sk-test",
		typesafeApiKey: "ts-test",
	}),
) {
	return Dumgen.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				HttpTransport.layer(requestUrl),
				ProviderKeys.layer(keys),
			),
		),
	);
}

/** The `Dumgen` service itself, built at once. */
export function dumgenServiceOver(
	requestUrl: RequestUrl,
	keys?: () => DumgenProviderKeys,
): Dumgen["Service"] {
	return Effect.runSync(
		Effect.gen(function* () {
			return yield* Dumgen;
		}).pipe(Effect.provide(dumgenLayerOver(requestUrl, keys))),
	);
}

/** A `requestUrl` that fails the test if anything reaches a provider. */
export const unreachable: RequestUrl = () =>
	Promise.reject(new Error("a provider was reached"));

/** `Dumgen.provide` over fakes: each call builds `fakeDumgen(fakes)` afresh. */
export function provideFakes(
	fakes: Parameters<typeof fakeDumgen>[0] = {},
): DumgenProvide {
	return (effect) => Effect.provide(effect, fakeDumgen(fakes));
}
