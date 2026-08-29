import { randomUUID } from "node:crypto";
import type { ObsidianCli } from "./cli";
import { parseCliJson } from "./cli";
import { HarnessError } from "./errors";
import { DRIVER_COMMAND } from "./session";

interface DriverResponse {
	readonly error?: unknown;
	readonly generation?: unknown;
	readonly instanceId?: unknown;
	readonly ok?: unknown;
	readonly protocol?: unknown;
	readonly sessionId?: unknown;
	readonly value?: unknown;
}

export interface ReadyReceipt {
	readonly generation: number;
	readonly instanceId: string;
	readonly value: unknown;
}

export async function awaitDriverReady(
	cli: ObsidianCli,
	sessionId: string,
): Promise<ReadyReceipt> {
	const request = {
		method: "ready",
		params: {},
		protocol: 1,
		requestId: randomUUID(),
		sessionId,
	};
	const encoded = Buffer.from(JSON.stringify(request), "utf8").toString("base64url");
	const result = await cli.call([DRIVER_COMMAND, `request=${encoded}`], {
		timeoutMs: 60_000,
	});
	const response = parseCliJson<DriverResponse>(result.stdout, DRIVER_COMMAND);
	if (
		response.protocol !== 1 ||
		response.ok !== true ||
		response.sessionId !== sessionId ||
		typeof response.instanceId !== "string" ||
		response.instanceId.length === 0 ||
		!Number.isSafeInteger(response.generation) ||
		(response.generation as number) < 0
	) {
		throw new HarnessError(
			"CLI_PROTOCOL",
			`Driver readiness failed or returned an invalid envelope: ${JSON.stringify(response)}`,
			{ command: DRIVER_COMMAND, stdout: result.stdout },
		);
	}
	return {
		generation: response.generation as number,
		instanceId: response.instanceId,
		value: response.value,
	};
}
