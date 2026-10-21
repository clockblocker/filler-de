/**
 * The report names each provider failure in one line (#147), not with the
 * provider's JSON body, which broke its Markdown list.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Effect } from "effect";
import { dirResetVault } from "../../../scripts/dictionary-reset/dir-reset-vault";
import { dryRunReset } from "../../../src/commanders/dictionary-reset/execute";
import {
	type RegenerationResult,
	renderReport,
} from "../../../src/commanders/dictionary-reset/report";

const FIXTURE = join(import.meta.dir, "fixtures/vault");

/** dumgen's reason for an expired OpenAI key, its body cut at 200 characters. */
const EXPIRED = `resolution left it pending: dumgen could not resolve its grammar: OpenAI answered 401: ${`{
  "error": {
    "message": "Your API key has expired. Create a new API key to continue.",
    "type": "invalid_request_error",
    "code": "expired_secret_key",
    "param": null
  },
  "status": 401
}`.slice(0, 200)}`;

describe("renderReport's failures", () => {
	it("shows a provider's refusal as one line per attestation", async () => {
		const { plan } = await Effect.runPromise(
			dryRunReset(dirResetVault(FIXTURE)),
		);
		const failed: RegenerationResult = { _tag: "Unresolved", reason: EXPIRED };
		const ready = plan.attestations.filter(
			({ outcome }) => outcome._tag === "Ready",
		).length;
		expect(ready).toBeGreaterThan(0);
		const report = renderReport(plan, {
			backupFolder: "Worter backup 2026-10-21 17-26-37",
			cancelled: false,
			freeform: plan.freeform.map(() => ({
				_tag: "Unplaced" as const,
				reason: "no Lemma was regenerated",
			})),
			layout: undefined,
			notices: [`Classify skipped a link: TypeSafe answered 500: ${"x".repeat(50)}`],
			regenerations: plan.attestations.map(({ outcome }) =>
				outcome._tag === "Ready" ? failed : undefined,
			),
		});
		const failures = report
			.split("\n")
			.filter((line) => line.includes("could not resolve its grammar"));
		expect(failures).toHaveLength(ready);
		for (const line of failures)
			expect(line).toEndWith(
				": resolution left it pending: dumgen could not resolve its grammar: OpenAI rejected the API key (401 expired_secret_key)",
			);
		expect(report).not.toContain('"error"');
		expect(report).not.toContain("expired. Create");
		expect(report).toContain(
			"- Classify skipped a link: TypeSafe failed on its side (500)",
		);
	});
});
