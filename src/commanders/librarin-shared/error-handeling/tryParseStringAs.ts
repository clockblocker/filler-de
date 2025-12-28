import { err, ok, type Result } from "neverthrow";

import type z from "zod";

import { CUSTOM_ERROR_CODE } from "../types/literals";

type ZodIssue = z.core.$ZodIssue;

export const makeTryParseStringAs =
	<T, E extends string = string>(
		schema: z.ZodType<T>,
		opts?: {
			label?: string;
			unknownIssuesToError?: (issues: ZodIssue[]) => E;
		},
	) =>
	(input: string): Result<T, E> => {
		const res = schema.safeParse(input);
		if (res.success) return ok(res.data);

		const issues = res.error.issues;

		const custom = issues.find((i) => i.code === CUSTOM_ERROR_CODE);
		if (custom) return err(custom.message as E);

		if (opts?.unknownIssuesToError) {
			return err(opts.unknownIssuesToError(issues));
		}

		const msg = issues.map((i) => i.message).join("; ");
		const label = opts?.label ?? "value";
		return err(`Invalid ${label}: "${input}". ${msg}` as E);
	};
