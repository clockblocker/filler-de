import { describe, expect, it } from "bun:test";
import { JevTransport, type LunaAsk, LunaTransport } from "dumgen";
import { Effect, Exit, Scope } from "effect";
import { dumgenOver } from "../../../src/managers/dumgen";

/**
 * A Luna that holds every request until `release()`, counting how many it
 * holds at once.
 */
function heldLuna() {
	let held = 0;
	let mostHeld = 0;
	let received = 0;
	const waiting: (() => void)[] = [];
	const ask: LunaAsk = async () => {
		received++;
		held++;
		mostHeld = Math.max(mostHeld, held);
		await new Promise<void>((resolve) => waiting.push(resolve));
		held--;
		return { output: "The dog sleeps." };
	};
	return {
		ask,
		mostHeld: () => mostHeld,
		received: () => received,
		release: () => {
			for (const resolve of waiting.splice(0)) resolve();
		},
	};
}

const noJev = JevTransport.fromAsk(() => Promise.reject(new Error("no jev")));

const translate = (dumgen: ReturnType<typeof dumgenOver>) =>
	dumgen.translate.sentence({
		into: "en",
		language: "de",
		sentence: "Der Hund schläft.",
	});

/** Waits until `luna` holds `count` requests. */
async function untilReceived(
	luna: ReturnType<typeof heldLuna>,
	count: number,
): Promise<void> {
	while (luna.received() < count) await Bun.sleep(0);
}

describe("dumgenOver", () => {
	it("runs every operation of one instance on one request budget", async () => {
		const luna = heldLuna();
		const dumgen = dumgenOver({
			jev: noJev,
			luna: LunaTransport.fromAsk(luna.ask),
			requestBudget: 1,
		});
		const both = Effect.runPromise(
			Effect.all([translate(dumgen), translate(dumgen)], {
				concurrency: "unbounded",
			}),
		);
		await untilReceived(luna, 1);
		await Bun.sleep(20);
		expect(luna.received()).toBe(1);
		luna.release();
		await untilReceived(luna, 2);
		luna.release();
		expect(await both).toEqual(["The dog sleeps.", "The dog sleeps."]);
		expect(luna.mostHeld()).toBe(1);
	});

	it("gives each instance a budget of its own", async () => {
		const luna = heldLuna();
		const options = {
			jev: noJev,
			luna: LunaTransport.fromAsk(luna.ask),
			requestBudget: 1,
		};
		const both = Effect.runPromise(
			Effect.all(
				[translate(dumgenOver(options)), translate(dumgenOver(options))],
				{ concurrency: "unbounded" },
			),
		);
		await untilReceived(luna, 2);
		luna.release();
		await both;
		expect(luna.mostHeld()).toBe(2);
	});

	it("builds in the scope it is given, which releases it", async () => {
		const scope = Scope.makeUnsafe();
		expect(scope.state._tag).toBe("Empty");
		dumgenOver(
			{ jev: noJev, luna: LunaTransport.fromAsk(heldLuna().ask) },
			scope,
		);
		expect(scope.state._tag).toBe("Open");
		await Effect.runPromise(Scope.close(scope, Exit.void));
		expect(scope.state._tag).toBe("Closed");
	});
});
