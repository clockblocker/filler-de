import { multiSpanHelper } from "../../../../stateless-helpers/multi-span";
import type { PromptOutput } from "../../llm/prompt-catalog";

type LemmaPromptOutput = PromptOutput<"Lemma">;

type LemmaOutputGuardrailEvaluation = {
	coreIssues: string[];
	droppedContextWithLinkedParts: boolean;
	output: LemmaPromptOutput;
};

const COMMON_SEPARABLE_PREFIXES = [
	"ab",
	"an",
	"auf",
	"aus",
	"bei",
	"ein",
	"fort",
	"her",
	"hin",
	"los",
	"mit",
	"nach",
	"vor",
	"weg",
	"zu",
	"zurück",
	"zusammen",
] as const;

function normalizeGermanToken(value: string): string {
	return value.trim().toLocaleLowerCase("de-DE");
}

function hasSeparableVerbEvidence(context: string, surface: string): boolean {
	const rawContext = multiSpanHelper.stripBrackets(context);
	const lowerContext = normalizeGermanToken(rawContext);
	const lowerSurface = normalizeGermanToken(surface);

	if (!lowerContext.includes(lowerSurface)) {
		return false;
	}

	const tailTokenMatch = lowerContext.match(
		/\b([a-zäöüß]+)\b(?:[.!?…]+)?\s*$/u,
	);
	const tailToken = tailTokenMatch?.[1];
	if (!tailToken || tailToken === lowerSurface) {
		return false;
	}

	return COMMON_SEPARABLE_PREFIXES.includes(
		tailToken as (typeof COMMON_SEPARABLE_PREFIXES)[number],
	);
}

function looksComparativeOrSuperlative(surface: string): boolean {
	const lowerSurface = normalizeGermanToken(surface);
	if (lowerSurface.length < 4) {
		return false;
	}

	const inflectedSuffixes = [
		"er",
		"ere",
		"eren",
		"erem",
		"erer",
		"eres",
		"ste",
		"sten",
		"stem",
		"ster",
		"stes",
	] as const;

	return inflectedSuffixes.some((suffix) => lowerSurface.endsWith(suffix));
}

function contextWithLinkedPartsMatches(
	context: string,
	contextWithLinkedParts: string,
): boolean {
	return (
		multiSpanHelper.stripBrackets(contextWithLinkedParts) ===
		multiSpanHelper.stripBrackets(context)
	);
}

export function evaluateLemmaOutputGuardrails(params: {
	context: string;
	output: LemmaPromptOutput;
	surface: string;
}): LemmaOutputGuardrailEvaluation {
	const { context, output, surface } = params;
	const coreIssues: string[] = [];

	let sanitizedOutput: LemmaPromptOutput = output;
	let droppedContextWithLinkedParts = false;

	const linkedParts = output.contextWithLinkedParts;
	if (
		typeof linkedParts === "string" &&
		linkedParts.length > 0 &&
		!contextWithLinkedPartsMatches(context, linkedParts)
	) {
		sanitizedOutput = {
			...output,
			contextWithLinkedParts: undefined,
		};
		droppedContextWithLinkedParts = true;
	}

	const normalizedLemma = normalizeGermanToken(output.lemma);
	const normalizedSurface = normalizeGermanToken(surface);
	const hasSameSurfaceLemma = normalizedLemma === normalizedSurface;

	if (
		hasSameSurfaceLemma &&
		output.linguisticUnit === "Lexem" &&
		output.posLikeKind === "Verb" &&
		output.surfaceKind === "Inflected" &&
		hasSeparableVerbEvidence(context, surface)
	) {
		coreIssues.push(
			"inflected separable verb resolved to same-surface lemma",
		);
	}

	if (
		hasSameSurfaceLemma &&
		output.linguisticUnit === "Lexem" &&
		output.posLikeKind === "Adjective" &&
		output.surfaceKind === "Inflected" &&
		looksComparativeOrSuperlative(surface)
	) {
		coreIssues.push(
			"inflected adjective comparative/superlative resolved to same-surface lemma",
		);
	}

	return {
		coreIssues,
		droppedContextWithLinkedParts,
		output: sanitizedOutput,
	};
}

export function chooseBestEffortLemmaOutput(params: {
	first: LemmaOutputGuardrailEvaluation;
	second: LemmaOutputGuardrailEvaluation;
}): LemmaOutputGuardrailEvaluation {
	const { first, second } = params;

	if (second.coreIssues.length === 0) {
		return second;
	}
	if (first.coreIssues.length === 0) {
		return first;
	}
	if (second.coreIssues.length < first.coreIssues.length) {
		return second;
	}
	if (first.coreIssues.length < second.coreIssues.length) {
		return first;
	}
	// If equally risky, prefer retry output as most recent model decision.
	return second;
}
