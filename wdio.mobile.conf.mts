import * as path from "path"
import { env } from "process";
import { obsidianBetaAvailable, parseObsidianVersions } from "wdio-obsidian-service";

// Use this wdio configuration to test Obsidian against the real Obsidian Android app.
// Add `"test:android": "wdio run ./wdio.mobile.conf.mts"` to package.json to enable it.
// You'll need to set up Android Studio and Appium for this to work, see
// https://jesse-r-s-hines.github.io/wdio-obsidian-service/wdio-obsidian-service/README#android
// If your plugin "isDesktopOnly", or if you want to just use the desktop "emulateMobile"
// testing instead, just delete this file.

const cacheDir = path.resolve(".obsidian-cache");

// choose Obsidian versions to test
// note: beta versions aren't available for the Android app
let defaultVersions = "earliest/earliest latest/latest";
const versions = await parseObsidianVersions(
    env.OBSIDIAN_MOBILE_VERSIONS ?? env.OBSIDIAN_VERSIONS ?? defaultVersions,
    {cacheDir},
);
if (env.CI) {
    console.log("obsidian-cache-key:", JSON.stringify(versions));
}

export const config: WebdriverIO.Config = {

    cacheDir: cacheDir,

    // (installerVersion isn't relevant for the mobile app)
    capabilities: versions.map<WebdriverIO.Capabilities>(([appVersion]) => ({
        'appium:adbExecTimeout': 60 * 1000,
        'appium:automationName': 'UiAutomator2',
        'appium:avd': "obsidian_test",
        'appium:noReset': true, // wdio-obsidian-service will handle installing Obsidian
        browserName: "obsidian",
        platformName: 'Android',
        'wdio:obsidianOptions': {
            appVersion: appVersion,
            plugins: ["."],
            vault: "test/vaults/simple",
        },
    })),
    framework: 'mocha',
    hostname: env.APPIUM_HOST || 'localhost',
    logLevel: "warn",

    maxInstances: 1, // Parallel tests don't work under appium

    mochaOpts: {
        timeout: 60 * 1000,
        ui: 'bdd',
    },
    port: parseInt(env.APPIUM_PORT || "4723"),
    reporters: ["obsidian"],
    runner: 'local',

    services: [
        "obsidian",
        ["appium", {
            args: { allowInsecure: "chromedriver_autodownload,adb_shell" },
        }],
    ],

    specs: ['./test/specs/**/*.e2e.ts'],
    waitforInterval: 250,
    waitforTimeout: 5 * 1000,
}
