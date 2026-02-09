/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

const { notarize } = require("@electron/notarize");

module.exports = async function notarizeAfterSign(context) {
	if (context.electronPlatformName !== "darwin") {
		return;
	}

	const appleId = process.env.APPLE_ID;
	const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
	const teamId = process.env.APPLE_TEAM_ID;

	if (!appleId || !appleIdPassword || !teamId) {
		console.warn(
			"[notarize] Skipping notarization because APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID are not fully set.",
		);
		return;
	}

	const appName = context.packager.appInfo.productFilename;
	const appPath = path.join(context.appOutDir, `${appName}.app`);

	await notarize({
		appPath,
		appleId,
		appleIdPassword,
		teamId,
	});
};
