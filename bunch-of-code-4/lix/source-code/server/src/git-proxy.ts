/**
 * ------------------------------------
 * The git proxy routes and authenticates requests
 * to git hosts like GitHub and GitLab.
 *
 * The proxy exists to avoid CORS issues and authenticate
 * requests.
 * ------------------------------------
 */

import type { NextFunction, Request, Response } from "express"
// @ts-ignore
import createMiddleware from "./auth/cors-middleware.js"
import { decryptAccessToken } from "./auth/implementation.js"
import { privateEnv } from "@inlang/env-variables"
const allowedOrigins = privateEnv.PUBLIC_ALLOWED_AUTH_URLS?.split(",")
const production = process.env.NODE_ENV === "production"

const middleware = createMiddleware({
	// This is the cors allowed origin:
	origins: allowedOrigins,
	insecure_origins: production ? [] : ["localhost:8089"],

	authorization: async (request: Request, _response: Response, next: NextFunction) => {
		try {
			const encryptedAccessToken = request.session?.encryptedAccessToken

			if (encryptedAccessToken) {
				const decryptedAccessToken = await decryptAccessToken({
					JWE_SECRET_KEY: privateEnv.JWE_SECRET,
					jwe: encryptedAccessToken,
				})

				request.headers["authorization"] = `Basic ${btoa(decryptedAccessToken)}`
			}

			return next()
		} catch (err) {
			next(err)
		}
	},
})

export async function proxy(request: Request, response: Response, next: NextFunction) {
	try {
		// remove the proxy path from the url
		const targetUrl = request.url.split("git-proxy/")[1]

		if (typeof targetUrl === "undefined") {
			response.status(400).send("Missing target url")
			return
		}

		if (!targetUrl.startsWith("github.com/") && production) {
			response.status(403).send("Only github supported")
			return
		}

		request.url = "/" + targetUrl

		response.set("Access-Control-Allow-Credentials", "true")
		response.set("Access-Control-Allow-Headers", "user-agent")

		middleware(request, response, next)
	} catch (error) {
		next(error)
	}
}
