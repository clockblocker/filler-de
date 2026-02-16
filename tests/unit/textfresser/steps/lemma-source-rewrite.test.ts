import { describe, expect, it } from "bun:test";
import { rewriteAttestationSourceContent } from "../../../../src/commanders/textfresser/commands/lemma/lemma-command";

describe("rewriteAttestationSourceContent", () => {
	it("replaces exact raw block when present", () => {
		const rawBlock =
			'"Aschenputtel," sprach sie, "bist voll Staub und Schmutz?" ^1';
		const updatedBlock =
			'"Aschenputtel," sprach sie, "bist voll [[Staub]] und Schmutz?" ^1';
		const content = `A\n${rawBlock}\nB`;

		const out = rewriteAttestationSourceContent({
			content,
			offsetInBlock: rawBlock.indexOf("Staub"),
			rawBlock,
			surface: "Staub",
			updatedBlock,
			wikilink: "[[Staub]]",
		});

		expect(out).toContain(updatedBlock);
		expect(out).not.toContain(rawBlock);
	});

	it("falls back to block-id line replacement when raw block string mismatches", () => {
		const contentLine =
			'"Aschenputtel," sprach sie, "bist voll Staub und Schmutz?" ^1';
		const rawBlockWithMismatch =
			'""Aschenputtel," sprach sie, "bist voll Staub und Schmutz?" ^1';
		const content = `A\n${contentLine}\nB`;

		const out = rewriteAttestationSourceContent({
			content,
			offsetInBlock: rawBlockWithMismatch.indexOf("Staub"),
			rawBlock: rawBlockWithMismatch,
			surface: "Staub",
			updatedBlock:
				'"Aschenputtel," sprach sie, "bist voll [[Staub]] und Schmutz?" ^1',
			wikilink: "[[Staub]]",
		});

		expect(out).toContain(
			'"Aschenputtel," sprach sie, "bist voll [[Staub]] und Schmutz?" ^1',
		);
	});

	it("does not double-wrap when surface is already a wikilink", () => {
		const line = 'Sie sah [[Staub]] überall. ^1';
		const out = rewriteAttestationSourceContent({
			content: line,
			offsetInBlock: line.indexOf("Staub"),
			rawBlock: `${line} mismatch`,
			surface: "Staub",
			updatedBlock: line,
			wikilink: "[[Staub]]",
		});

		expect(out).toBe(line);
		expect(out).not.toContain("[[[Staub]]]");
	});

	it("falls back to first plain-surface replacement when no block id exists", () => {
		const content = "Viel Staub lag dort.";
		const out = rewriteAttestationSourceContent({
			content,
			offsetInBlock: undefined,
			rawBlock: "missing",
			surface: "Staub",
			updatedBlock: "unused",
			wikilink: "[[Staub]]",
		});

		expect(out).toBe("Viel [[Staub]] lag dort.");
	});

	it("retargets a temporary wikilink to the final wikilink on second pass", () => {
		const line = "Sie sah [[Staub]] überall. ^1";
		const out = rewriteAttestationSourceContent({
			content: line,
			offsetInBlock: "Sie sah Staub überall. ^1".indexOf("Staub"),
			rawBlock: "Sie sah Staub überall. ^1",
			surface: "Staub",
			updatedBlock: "Sie sah [[Library/de/noun/Staub|Staub]] überall. ^1",
			wikilink: "[[Library/de/noun/Staub|Staub]]",
		});

		expect(out).toBe("Sie sah [[Library/de/noun/Staub|Staub]] überall. ^1");
	});

	it("rewrites to final multi-span link after temporary single-span insertion", () => {
		const content = "A\nbei der Deutsche [[Bank]] eröffnet ^1\nB";
		const out = rewriteAttestationSourceContent({
			content,
			offsetInBlock: "bei der Deutsche Bank eröffnet ^1".indexOf("Bank"),
			rawBlock: "bei der Deutsche Bank eröffnet ^1",
			replaceOffsetInBlock: "bei der Deutsche Bank eröffnet ^1".indexOf(
				"Deutsche Bank",
			),
			replaceSurface: "Deutsche Bank",
			surface: "Bank",
			updatedBlock:
				"bei der [[Library/de/noun/deutsche-bank|Deutsche Bank]] eröffnet ^1",
			wikilink: "[[Library/de/noun/deutsche-bank|Deutsche Bank]]",
		});

		expect(out).toContain(
			"bei der [[Library/de/noun/deutsche-bank|Deutsche Bank]] eröffnet ^1",
		);
	});

	it("does not double-wrap on second pass when final link already exists", () => {
		const line = "Sie sah [[Library/de/noun/Staub|Staub]] überall. ^1";
		const out = rewriteAttestationSourceContent({
			content: line,
			offsetInBlock: "Sie sah Staub überall. ^1".indexOf("Staub"),
			rawBlock: "Sie sah Staub überall. ^1",
			surface: "Staub",
			updatedBlock: line,
			wikilink: "[[Library/de/noun/Staub|Staub]]",
		});

		expect(out).toBe(line);
		expect(out).not.toContain("[[[");
	});
});
