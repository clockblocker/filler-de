import { describe, expect, it } from "bun:test";
import {
	conciseFailure,
	providerAnswerLine,
} from "../../../src/managers/dumgen/provider-failure";

/** OpenAI's answer to an expired key, as dumgen cuts it at 200 characters. */
const EXPIRED = `{
  "error": {
    "message": "Your API key has expired. Create a new API key to continue.",
    "type": "invalid_request_error",
    "code": "expired_secret_key",
    "param": null
  },
  "status": 401
}`.slice(0, 200);

describe("providerAnswerLine", () => {
	it("names the provider, what the status means and the error code", () => {
		expect(providerAnswerLine("OpenAI", 401, EXPIRED)).toBe(
			"OpenAI rejected the API key (401 expired_secret_key)",
		);
		expect(
			providerAnswerLine(
				"TypeSafe",
				401,
				'{"detail":{"error_type":"authentication_error","message":"Cannot authenticate"}}',
			),
		).toBe("TypeSafe rejected the API key (401 authentication_error)");
		expect(
			providerAnswerLine(
				"OpenAI",
				429,
				'{"error":{"code":"insufficient_quota","type":"insufficient_quota"}}',
			),
		).toBe("OpenAI has no quota left for the API key (429 insufficient_quota)");
		expect(providerAnswerLine("OpenAI", 503, "upstream connect error")).toBe(
			"OpenAI failed on its side (503)",
		);
		expect(
			providerAnswerLine("TypeSafe", 422, '{"detail":[{"msg":"x"}]}'),
		).toBe("TypeSafe refused the request (422)");
	});
});

describe("conciseFailure", () => {
	it("folds a provider's cut JSON body into one line", () => {
		expect(
			conciseFailure(
				`resolution left it pending: dumgen could not resolve its grammar: OpenAI answered 401: ${EXPIRED}`,
			),
		).toBe(
			"resolution left it pending: dumgen could not resolve its grammar: OpenAI rejected the API key (401 expired_secret_key)",
		);
	});

	it("keeps the reasons Classify joined after a whole body", () => {
		expect(
			conciseFailure(
				'dumgen could not resolve its grammar: TypeSafe answered 403: {"detail":{"error_type":"permission_denied"}}; segmentation left its route unresolved',
			),
		).toBe(
			"dumgen could not resolve its grammar: TypeSafe refused access with the API key (403 permission_denied); segmentation left its route unresolved",
		);
	});

	it("rewrites every provider answer in the text", () => {
		expect(
			conciseFailure(
				`a: OpenAI answered 401: ${EXPIRED}; b: TypeSafe answered 500: oops`,
			),
		).toBe(
			"a: OpenAI rejected the API key (401 expired_secret_key); b: TypeSafe failed on its side (500)",
		);
	});

	it("leaves other failures as they are, on one line", () => {
		expect(conciseFailure("OpenAI did not answer within 120000 ms")).toBe(
			"OpenAI did not answer within 120000 ms",
		);
		expect(conciseFailure("its Sentence\nwas  not segmented ")).toBe(
			"its Sentence was not segmented",
		);
	});
});
