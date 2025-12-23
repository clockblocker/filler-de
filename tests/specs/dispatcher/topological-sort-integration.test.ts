/// <reference types="@wdio/globals/types" />
import { expect } from "@wdio/globals";
import { getVaultActionManagerTestingApi } from "./utils";

describe("Topological Sort Integration", () => {
	it("should sort ProcessMdFile after CreateMdFile when feature flag enabled", async () => {
		const { manager, splitPath } = getVaultActionManagerTestingApi();

		// Create actions in wrong order (process before create)
		const actions = [
			{
				type: "ProcessMdFile",
				payload: {
					splitPath: splitPath("test.md") as unknown,
					transform: (content: string) => content + "\nprocessed",
				},
			},
			{
				type: "CreateMdFile",
				payload: {
					splitPath: splitPath("test.md") as unknown,
					content: "initial",
				},
			},
		] as unknown[];

		const result = await manager.dispatch(actions);
		expect(result.isOk()).toBe(true);

		// File should exist with processed content
		const content = await manager.readContent(splitPath("test.md") as unknown);
		expect(content).toContain("initial");
		expect(content).toContain("processed");
	});

	it("should sort parent folders before child folders", async () => {
		const { manager, splitPath } = getVaultActionManagerTestingApi();

		// Create actions in wrong order (child before parent)
		const actions = [
			{
				type: "CreateFolder",
				payload: {
					splitPath: splitPath("parent/child") as unknown,
				},
			},
			{
				type: "CreateFolder",
				payload: {
					splitPath: splitPath("parent") as unknown,
				},
			},
		] as unknown[];

		const result = await manager.dispatch(actions);
		expect(result.isOk()).toBe(true);

		// Both folders should exist
		const parentExists = await manager.exists(
			splitPath("parent") as unknown,
		);
		const childExists = await manager.exists(
			splitPath("parent/child") as unknown,
		);
		expect(parentExists).toBe(true);
		expect(childExists).toBe(true);
	});

	it("should sort CreateMdFile before ProcessMdFile for nested files", async () => {
		const { manager, splitPath } = getVaultActionManagerTestingApi();

		const actions = [
			{
				type: "ProcessMdFile",
				payload: {
					splitPath: splitPath("folder/file.md") as unknown,
					transform: (content: string) => content + "\nprocessed",
				},
			},
			{
				type: "CreateMdFile",
				payload: {
					splitPath: splitPath("folder/file.md") as unknown,
					content: "initial",
				},
			},
		] as unknown[];

		const result = await manager.dispatch(actions);
		expect(result.isOk()).toBe(true);

		const content = await manager.readContent(
			splitPath("folder/file.md") as unknown,
		);
		expect(content).toContain("initial");
		expect(content).toContain("processed");
	});
});

