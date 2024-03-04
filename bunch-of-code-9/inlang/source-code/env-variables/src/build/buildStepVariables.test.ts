import { it, expect } from "vitest"
import { buildStepVariables } from "./buildStepVariables.js"

it("should return a stringified JSON because bundlers expect a stringified JSON", () => {
	const def = buildStepVariables()
	expect(typeof def.PUBLIC_ENV_DEFINED_IN_BUILD_STEP).toBe("string")
	expect(JSON.parse(def.PUBLIC_ENV_DEFINED_IN_BUILD_STEP)).toBeInstanceOf(Object)
})

it('should only define public env variables that start with "PUBLIC_"', () => {
	process.env.PUBLIC_BASE_URL = "https://inlang.com"
	process.env.API_TOKEN = "blabla"
	const def = buildStepVariables()
	const publicEnv = JSON.parse(def.PUBLIC_ENV_DEFINED_IN_BUILD_STEP)
	expect(publicEnv.PUBLIC_BASE_URL).toBe("https://inlang.com")
	expect(publicEnv).not.toHaveProperty("API_TOKEN")
})
