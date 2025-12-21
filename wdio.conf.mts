import * as path from "path"
import { env } from "process";
import { parseObsidianVersions } from "wdio-obsidian-service";
import { logger } from "./src/utils/logger";

// wdio-obsidian-service will download Obsidian versions into this directory
const cacheDir = path.resolve(".obsidian-cache");

// choose Obsidian versions to test (force stable; ignore env that may include beta)
const stableVersions = "latest/latest";
const desktopVersions = await parseObsidianVersions(stableVersions, { cacheDir });
const mobileVersions = await parseObsidianVersions(stableVersions, { cacheDir });
if (env.CI) {
    // Print the resolved Obsidian versions to use as the workflow cache key
    // (see .github/workflows/test.yaml)
    logger.debug("obsidian-cache-key:", JSON.stringify([desktopVersions, mobileVersions]));
}

export const config: WebdriverIO.Config = {

    cacheDir: cacheDir,

    // "matrix" to test your plugin on multiple Obsidian versions and with emulateMobile
    capabilities: [
        ...desktopVersions.map<WebdriverIO.Capabilities>(([appVersion, installerVersion]) => ({
            browserName: 'obsidian',
            'wdio:obsidianOptions': {
                appVersion,
                installerVersion,
                plugins: ["."],
                vault: "tests/simple",
            },
        })),
        ...mobileVersions.map<WebdriverIO.Capabilities>(([appVersion, installerVersion]) => ({
            browserName: 'obsidian',
            'goog:chromeOptions': {
                mobileEmulation: {
                    deviceMetrics: { height: 844, width: 390 },
                },
            },
            'wdio:obsidianOptions': {
                appVersion,
                emulateMobile: true,
                installerVersion,
                plugins: ["."],
                vault: "tests/simple",
            },
        })),
    ],
    framework: 'mocha',
    logLevel: "warn",

    // How many instances of Obsidian should be launched in parallel during testing.
    maxInstances: Number(env.WDIO_MAX_INSTANCES || 4),

    mochaOpts: {
        timeout: 60 * 1000,
        ui: 'bdd',
        // You can set more config here like "retry" to retry flaky tests or "bail" to
        // quit tests after the first failure.
    },
    // You can use any wdio reporter, but they show the Chromium version instead of the
    // Obsidian version a test is running on. obsidian-reporter is just a wrapper around
    // spec-reporter that shows the Obsidian version.
    reporters: ['obsidian'],
    runner: 'local',

    services: ["obsidian"],

    specs: ['./tests/specs/**/*.e2e.ts'],
    waitforInterval: 250,
    waitforTimeout: 5 * 1000,
}
