import { Effect } from "effect";
import type { VamFileWriteError } from "../../effect/errors";

export function annotateFileAccessFailure(error: VamFileWriteError) {
	const path = "path" in error ? error.path : undefined;
	return Effect.annotateCurrentSpan({
		"error.operation": error.operation,
		...(path ? { "error.path": path, path } : {}),
		"error.reason":
			error._tag === "VamActiveEditorError" ? error.reason : error._tag,
		"error.tag": error._tag,
	});
}
