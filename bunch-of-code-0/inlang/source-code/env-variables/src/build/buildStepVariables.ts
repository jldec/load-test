import { fileURLToPath } from "node:url"
import path from "node:path"

export const rootEnvFilePath = path.join(fileURLToPath(import.meta.url), "../../../../../../.env")
/**
 * Define the public environment variables.
 *
 * Use in the build step to define the public environment variables.
 * ! Never use this function outside of a build step to avoid exposing
 * ! private environment variables to the client/browser.
 */
export function buildStepVariables() {
	const publicEnv: Record<string, string> = {
		PUBLIC_IS_DEV: process.env.DEV ? "true" : "false",
	}
	for (const key in process.env) {
		if (key.startsWith("PUBLIC_")) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			publicEnv[key] = process.env[key]!
		}
	}
	return {
		PUBLIC_ENV_DEFINED_IN_BUILD_STEP: JSON.stringify(publicEnv),
		ROOT_ENV_FILE_PATH: JSON.stringify(rootEnvFilePath),
	}
}
