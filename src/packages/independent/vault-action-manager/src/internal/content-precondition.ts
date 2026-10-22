import { Predicate, Schema } from "effect";
import type { ExpectedContent, Transform } from "../types/vault-action";
import { vaultContentHash } from "./content-hash";

/** Whether `content` is what `expected` names: equal, or of the named hash. */
export function contentMatches(
	content: string,
	expected: ExpectedContent,
): boolean {
	return Predicate.isString(expected)
		? content === expected
		: vaultContentHash(content) === expected.hash;
}

const ExpectedContentSchema = Schema.Union([
	Schema.String,
	Schema.Struct({ hash: Schema.String }),
]);

/**
 * Thrown by a guarded transform whose file holds other content than its
 * action expected, from inside the `Vault.process` callback. The writers
 * keep it as the `cause` of the `VamContentConflictError` they fail with,
 * having written nothing.
 */
export class ContentPreconditionFailed extends Schema.TaggedError<ContentPreconditionFailed>()(
	"ContentPreconditionFailed",
	{ expected: ExpectedContentSchema },
) {
	override get message(): string {
		return `The file no longer holds the content the action expected (${describe(this.expected)}); nothing was written`;
	}
}

/**
 * `transform` behind a check that it receives `expected`. The check runs
 * synchronously, in the same call as the transform, so a synchronous
 * transform stays synchronous and `Vault.process` checks and writes in one
 * atomic step.
 */
export function guardTransform(
	transform: Transform,
	expected: ExpectedContent | undefined,
): Transform {
	if (expected === undefined) return transform;
	return (content) => {
		if (!contentMatches(content, expected))
			throw new ContentPreconditionFailed({ expected });
		return transform(content);
	};
}

function describe(expected: ExpectedContent): string {
	return Predicate.isString(expected)
		? `${expected.length} characters, hash ${vaultContentHash(expected)}`
		: `hash ${expected.hash}`;
}
