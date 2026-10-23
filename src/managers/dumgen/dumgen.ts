/**
 * The plugin's dumgen (Dumgen ADR 0009): a service of the plugin runtime
 * that runs each action on one `DumgenLive` build.
 *
 * dumgen's operations are Effects that need `Jev` and `Luna`, and code
 * that calls them says so in its type. The action's edge runs it through
 * `provide`, which builds `DumgenLive` once for it, so the operations of
 * one action share one request budget, and the next action gets a fresh
 * one. Background runs, such as each Reading's Knowledge, run through
 * `provideBackground` instead, on one build they share, so together they
 * keep at most one budget of requests in flight however many run at once.
 *
 * Every build sends through `HttpTransport` with the keys `ProviderKeys`
 * answers, read when the action starts, so a changed key applies to the
 * next action; one already running finishes on the key it began with. A
 * build that fails is a `DumgenUnavailable`. Each operation's trace goes
 * onto its `dumgen.operation` span (`operation-spans.ts`).
 *
 * An action's build lives as long as the action, and the shared one as
 * long as the runtime. Unloading the plugin interrupts every action and
 * background run still going, and an interrupted call aborts its request.
 */
import { sha256Hex } from "@textfresser/lemma-note-codec";
import {
	DumgenLive,
	type Jev,
	JevTransport,
	type Luna,
	LunaTransport,
	type operations,
} from "dumgen";
import {
	Context,
	Data,
	Effect,
	Layer,
	Ref,
	Scope,
	SynchronizedRef,
} from "effect";
import { getErrorMessage } from "../../utils/get-error-message";
import { HttpTransport } from "./http-transport";
import {
	checkProviderKeys,
	KEY_CHECK_URLS,
	type KeyCheckFailure,
} from "./key-check";
import { makeOperationSpans } from "./operation-spans";
import type { ProviderName } from "./provider-failure";
import { ProviderKeys } from "./provider-keys";
import { type DumgenProviderKeys, dumgenTransports } from "./providers";
import { createScriptedJev, type ScriptedJevAnswers } from "./scripted-jev";
import { createScriptedLuna, type ScriptedLunaAnswers } from "./scripted-luna";

/** dumgen's operations, as code that calls them through a dependency names them. */
export type DumgenOperations = typeof operations;

/** `DumgenLive` could not be built for an action, which then asks nothing. */
export class DumgenUnavailable extends Data.TaggedError("DumgenUnavailable")<{
	readonly cause: unknown;
	/** `dumgen is unavailable: …` */
	readonly message: string;
}> {}

/** Runs `effect` on one `DumgenLive` build: one action, one request budget. */
export type DumgenProvide = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E | DumgenUnavailable, Exclude<R, Jev | Luna>>;

/** How a scripted provider answers the key check: 200 with no body unless given. */
type ScriptedKeyCheck = Partial<
	Record<ProviderName, { readonly status: number; readonly body?: string }>
>;

/**
 * A provider-free dumgen's script: jev's answers and, optionally, Luna's,
 * and how each provider answers the key check.
 */
export type ScriptedDumgen = {
	readonly jev: ScriptedJevAnswers;
	readonly luna?: ScriptedLunaAnswers;
	readonly keyCheck?: ScriptedKeyCheck;
};

/** How many requests a scripted dumgen's providers received, by stage. */
export type ScriptedDumgenRequests = {
	readonly jev: Readonly<Record<string, number>>;
	readonly luna: Readonly<Record<string, number>>;
};

type Transports = Pick<Parameters<typeof DumgenLive>[0], "jev" | "luna">;

type Built = Context.Context<Jev | Luna>;

type Scripted = {
	readonly transports: Transports;
	readonly tag: string;
	readonly requests: () => ScriptedDumgenRequests;
	readonly keyCheck: ScriptedKeyCheck;
};

const trimmed = (keys: DumgenProviderKeys): DumgenProviderKeys => ({
	openaiApiKey: keys.openaiApiKey.trim(),
	typesafeApiKey: keys.typesafeApiKey.trim(),
});

function scriptedFrom(script: ScriptedDumgen): Scripted {
	const jev = createScriptedJev(script.jev);
	const luna = createScriptedLuna(script.luna ?? {});
	return {
		keyCheck: script.keyCheck ?? {},
		requests: () => ({ jev: jev.requests(), luna: luna.requests() }),
		tag: sha256Hex(JSON.stringify([script.jev, crypto.randomUUID()])).slice(
			0,
			12,
		),
		transports: {
			jev: JevTransport.fromAsk(jev.ask),
			luna: LunaTransport.fromAsk(luna.ask),
		},
	};
}

/** A transport that answers the key check from a script and reaches no provider. */
const scriptedKeyCheck = (answers: ScriptedKeyCheck) =>
	HttpTransport.over((url) => {
		const answer =
			answers[url === KEY_CHECK_URLS.OpenAI ? "OpenAI" : "TypeSafe"];
		const status = answer?.status ?? 200;
		return Promise.resolve({
			ok: status >= 200 && status < 300,
			status,
			text: () => Promise.resolve(answer?.body ?? ""),
		});
	});

/** A Defect while building dumgen, its keys' read included, as `DumgenUnavailable`. */
const unavailable = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.catchDefect(effect, (defect) =>
		Effect.fail(
			new DumgenUnavailable({
				cause: defect,
				message: `dumgen is unavailable: ${getErrorMessage(defect)}`,
			}),
		),
	);

export class Dumgen extends Context.Service<
	Dumgen,
	{
		readonly provide: DumgenProvide;
		/**
		 * Runs a background run, such as a Reading's Knowledge, on the build
		 * every background run shares: one request budget for all of them.
		 * A key change starts a new shared build for the runs after it.
		 */
		readonly provideBackground: DumgenProvide;
		/**
		 * The providers whose key the settings lack, by name; none while a
		 * scripted dumgen stands in for them.
		 */
		readonly missingKeys: Effect.Effect<readonly ProviderName[]>;
		/**
		 * Checks the keys with each provider (`key-check.ts`), answering
		 * what failed; a scripted dumgen answers from its script.
		 */
		readonly checkKeys: Effect.Effect<readonly KeyCheckFailure[]>;
		/**
		 * Names the scripted jev in use, so its segmentations are cached
		 * apart from real ones and from every earlier script, the same one
		 * included: each scenario starts with a cold cache. Undefined with
		 * the real providers.
		 */
		readonly scriptedJevTag: Effect.Effect<string | undefined>;
		readonly testing: {
			/**
			 * Desktop E2E and in-process tests: until cleared with `null`,
			 * every action's jev and Luna answer from `script` (see
			 * `createScriptedJev` and `createScriptedLuna`), so no provider
			 * is reached; Luna refuses every request its script does not
			 * answer.
			 */
			readonly useScripted: (
				script: ScriptedDumgen | null,
			) => Effect.Effect<void>;
			/** The scripted dumgen's requests so far; undefined with the real providers. */
			readonly requests: Effect.Effect<
				ScriptedDumgenRequests | undefined
			>;
		};
	}
>()("textfresser/managers/dumgen/Dumgen") {
	static readonly layer: Layer.Layer<
		Dumgen,
		never,
		HttpTransport | ProviderKeys
	> = Layer.effect(
		Dumgen,
		Effect.gen(function* () {
			const http = yield* HttpTransport;
			const keys = yield* ProviderKeys;
			const lifetime = yield* Scope.Scope;
			const spans = makeOperationSpans();
			const scripted = yield* Ref.make<Scripted | undefined>(undefined);
			const keyed = yield* Ref.make<
				| {
						readonly keys: DumgenProviderKeys;
						readonly transports: Transports;
				  }
				| undefined
			>(undefined);

			const transports = Effect.gen(function* () {
				const script = yield* Ref.get(scripted);
				if (script) return script.transports;
				const read = trimmed(yield* keys.current);
				return yield* Ref.modify(keyed, (current) => {
					if (
						current &&
						current.keys.openaiApiKey === read.openaiApiKey &&
						current.keys.typesafeApiKey === read.typesafeApiKey
					)
						return [current.transports, current];
					const rebuilt = {
						keys: read,
						transports: dumgenTransports({
							...read,
							fetch: http.send,
						}),
					};
					return [rebuilt.transports, rebuilt];
				});
			});

			/**
			 * `DumgenLive` over `current`, in `scope`, on a memo map of its
			 * own, so a build made inside another action never reuses the
			 * outer one's services and budget. The memo map stays out of the
			 * context the action runs with.
			 */
			const build = (current: Transports, scope: Scope.Scope) =>
				Layer.buildWithMemoMap(
					DumgenLive({ ...current, onOperation: spans.sink }),
					Layer.makeMemoMapUnsafe(),
					scope,
				).pipe(
					Effect.map(
						(built): Built =>
							Context.omit(Layer.CurrentMemoMap)(built),
					),
					unavailable,
				);

			const provide: DumgenProvide = (effect) =>
				spans.traced(
					Effect.scopedWith((scope) =>
						transports.pipe(
							unavailable,
							Effect.flatMap((current) => build(current, scope)),
							Effect.flatMap((built) =>
								Effect.provideContext(effect, built),
							),
						),
					),
				);

			const shared = yield* SynchronizedRef.make<
				| { readonly transports: Transports; readonly built: Built }
				| undefined
			>(undefined);
			const provideBackground: DumgenProvide = (effect) =>
				spans.traced(
					transports.pipe(
						unavailable,
						Effect.flatMap((current) =>
							SynchronizedRef.modifyEffect(shared, (held) =>
								held?.transports === current
									? Effect.succeed([
											held.built,
											held,
										] as const)
									: Effect.map(
											build(current, lifetime),
											(built) =>
												[
													built,
													{
														built,
														transports: current,
													},
												] as const,
										),
							),
						),
						Effect.flatMap((built) =>
							Effect.provideContext(effect, built),
						),
					),
				);

			const missingKeys = Effect.gen(function* () {
				if (yield* Ref.get(scripted)) return [];
				const read = trimmed(yield* keys.current);
				return [
					...(read.typesafeApiKey ? [] : (["TypeSafe"] as const)),
					...(read.openaiApiKey ? [] : (["OpenAI"] as const)),
				];
			});

			const checkKeys = Effect.gen(function* () {
				const script = yield* Ref.get(scripted);
				return yield* script
					? checkProviderKeys({
							keys: {
								openaiApiKey: "scripted",
								typesafeApiKey: "scripted",
							},
						}).pipe(
							Effect.provideService(
								HttpTransport,
								scriptedKeyCheck(script.keyCheck),
							),
						)
					: checkProviderKeys({ keys: yield* keys.current }).pipe(
							Effect.provideService(HttpTransport, http),
						);
			});

			return Dumgen.of({
				checkKeys,
				missingKeys,
				provide,
				provideBackground,
				scriptedJevTag: Effect.map(
					Ref.get(scripted),
					(script) => script?.tag,
				),
				testing: {
					requests: Effect.map(Ref.get(scripted), (script) =>
						script?.requests(),
					),
					useScripted: (script) =>
						Effect.suspend(() =>
							Ref.set(
								scripted,
								script === null
									? undefined
									: scriptedFrom(script),
							),
						),
				},
			});
		}),
	);
}
