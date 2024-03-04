import * as Sentry from "@sentry/node"
import { version } from "../../../package.json"
import { ENV_VARIABLES } from "../../env-variables/index.js"

export function initErrorMonitoring() {
	Sentry.init({
		dsn: "https://b7a06c6d36454ef2bc5e2ca7e257bd5b@o4504345873285120.ingest.sentry.io/4505172745650176",
		release: version,
		// Not interested in performance data
		tracesSampleRate: 0,
		environment: ENV_VARIABLES.IS_PRODUCTION ? "production" : "development",
	})
}

export const captureException = Sentry.captureException
