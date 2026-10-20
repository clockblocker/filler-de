import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import {
	BATTERY_PACKAGES,
	git,
	REPO_ROOT,
	readLock,
	TEXTEATER_LINK,
	texteaterOverride,
	worktreeFor,
} from "../../../scripts/link-texteater";
import { batteryExports } from "./battery-probe";

type Manifest = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	exports?: Record<string, string | Record<string, string>>;
	scripts?: Record<string, string>;
};

const readManifest = (file: string): Manifest =>
	JSON.parse(readFileSync(file, "utf8")) as Manifest;

const texteater = realpathSync(TEXTEATER_LINK);
const batteryDir = (name: string) => path.join(texteater, "battery", name);
const batteryManifest = (name: string) =>
	readManifest(path.join(batteryDir(name), "package.json"));
const pluginManifest = readManifest(path.join(REPO_ROOT, "package.json"));
const pluginNodeModules = path.join(REPO_ROOT, "node_modules");

const tsconfigPaths = (
	parseJsonc(readFileSync(path.join(REPO_ROOT, "tsconfig.json"), "utf8")) as {
		compilerOptions: { paths: Record<string, string[]> };
	}
).compilerOptions.paths;

// Export subpaths that are not modules: manifests and raw JSON schemas.
const UNMAPPED_EXPORTS = new Set(["./package.json", "dumcorpus:./schema/*"]);

// Mapped to declarations only, so battery code may import types from it but
// no values.
const TYPE_ONLY_PACKAGES = new Set(["@typesafe-ai/sdk"]);

const isMapped = (specifier: string) =>
	specifier in tsconfigPaths ||
	Object.keys(tsconfigPaths).some(
		(key) => key.endsWith("/*") && specifier.startsWith(key.slice(0, -1)),
	);

describe("battery packages linked from texteater", () => {
	it("links the worktree at the SHA in batteries.lock", () => {
		if (texteaterOverride() !== undefined) return;
		const lock = readLock();
		expect(texteater).toBe(realpathSync(worktreeFor(lock)));
		expect(git(texteater, "rev-parse", "HEAD")).toBe(lock);
	});

	it("imports one export from each battery", () => {
		expect(Object.keys(batteryExports).sort()).toEqual(
			[...BATTERY_PACKAGES].sort(),
		);
		for (const value of Object.values(batteryExports)) {
			expect(typeof value).toBe("function");
		}
	});

	it("resolves each battery to its texteater source, not dist", () => {
		for (const name of BATTERY_PACKAGES) {
			expect(Bun.resolveSync(name, import.meta.dir)).toBe(
				path.join(batteryDir(name), "src", "index.ts"),
			);
		}
	});

	it("maps every battery export to its source entry in tsconfig paths", () => {
		for (const name of BATTERY_PACKAGES) {
			for (const [subpath, target] of Object.entries(
				batteryManifest(name).exports ?? {},
			)) {
				if (
					UNMAPPED_EXPORTS.has(subpath) ||
					UNMAPPED_EXPORTS.has(`${name}:${subpath}`)
				) {
					continue;
				}
				const source = typeof target === "string" ? target : target.bun;
				const specifier = `${name}${subpath.slice(1)}`;
				expect({ [specifier]: tsconfigPaths[specifier] }).toEqual({
					[specifier]: [
						`./.texteater/battery/${name}/${source?.replace(/^\.\//, "")}`,
					],
				});
			}
		}
	});

	it("maps every bare import in battery source to this repo", () => {
		const transpiler = new Bun.Transpiler({ loader: "ts" });
		const unmapped = new Set<string>();
		const typeOnlyValueImports = new Set<string>();
		for (const name of BATTERY_PACKAGES) {
			const src = path.join(batteryDir(name), "src");
			for (const file of new Bun.Glob("**/*.ts").scanSync({ cwd: src })) {
				if (file.endsWith(".test.ts")) continue;
				const code = readFileSync(path.join(src, file), "utf8");
				for (const { path: specifier } of transpiler.scanImports(code)) {
					if (/^(\.|node:|bun:)/.test(specifier)) continue;
					if (!isMapped(specifier)) unmapped.add(specifier);
					if (TYPE_ONLY_PACKAGES.has(specifier)) {
						typeOnlyValueImports.add(`${name}/src/${file}`);
					}
				}
			}
		}
		expect([...unmapped]).toEqual([]);
		expect([...typeOnlyValueImports]).toEqual([]);
	});

	it("declares every battery npm dependency with the battery's version", () => {
		const declared = {
			...pluginManifest.devDependencies,
			...pluginManifest.dependencies,
		};
		for (const name of BATTERY_PACKAGES) {
			for (const [dependency, version] of Object.entries(
				batteryManifest(name).dependencies ?? {},
			)) {
				if (version.startsWith("workspace:")) continue;
				expect({ [dependency]: declared[dependency] }).toEqual({
					[dependency]: version,
				});
			}
		}
	});

	it("resolves effect and zod inside batteries to the plugin's copies", () => {
		// Fails when `bun test` runs without --tsconfig-override=tsconfig.json:
		// battery files then resolve through texteater's own node_modules.
		const fromBattery = path.join(batteryDir("dumdict"), "src");
		for (const specifier of ["effect", "effect/Effect", "zod"]) {
			expect(Bun.resolveSync(specifier, fromBattery)).toStartWith(
				`${pluginNodeModules}/`,
			);
		}
	});

	it("bundles the batteries from source with the plugin's effect and zod", async () => {
		const buildRoot = pluginManifest.scripts?.["build:root"] ?? "";
		const outdir = mkdtempSync(path.join(tmpdir(), "battery-bundle-"));
		try {
			const metafile = path.join(outdir, "meta.json");
			const args = buildRoot
				.split(" ")
				.slice(2)
				.map((arg) =>
					arg === "./src/main.ts"
						? path.join(import.meta.dir, "battery-probe.ts")
						: arg.startsWith("--outfile=")
							? `--outfile=${path.join(outdir, "probe.js")}`
							: arg,
				);
			const build = Bun.spawnSync(
				["bun", "build", ...args, `--metafile=${metafile}`],
				{ cwd: REPO_ROOT, stderr: "pipe", stdout: "pipe" },
			);
			if (build.exitCode !== 0) throw new Error(build.stderr.toString());

			const inputs = Object.keys(
				(JSON.parse(readFileSync(metafile, "utf8")) as {
					inputs: Record<string, unknown>;
				}).inputs,
			).map((input) => path.resolve(REPO_ROOT, input));
			const packageRoots = (name: string) =>
				new Set(
					inputs
						.filter((input) =>
							input.includes(`/node_modules/${name}/`),
						)
						.map((input) =>
							input.slice(
								0,
								input.indexOf(`/node_modules/${name}/`),
							),
						),
				);
			expect([...packageRoots("effect")]).toEqual([REPO_ROOT]);
			expect([...packageRoots("zod")]).toEqual([REPO_ROOT]);
			expect(
				inputs.filter((input) => input.includes("/dist/")),
			).not.toContainEqual(expect.stringContaining("/battery/"));
		} finally {
			rmSync(outdir, { force: true, recursive: true });
		}
	});
});
