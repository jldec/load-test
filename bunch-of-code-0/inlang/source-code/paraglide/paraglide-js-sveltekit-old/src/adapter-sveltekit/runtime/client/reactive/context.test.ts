import { test, describe, expect, vi, beforeEach, type Mock } from "vitest"
import { getRuntimeFromContext, addRuntimeToContext } from "./context.js"
import * as svelte from "svelte"
import { type SvelteKitClientRuntime, initSvelteKitClientRuntime } from "../runtime.js"
import { get } from "svelte/store"

let mockedFetch: Mock
let runtime: SvelteKitClientRuntime

beforeEach(async () => {
	vi.resetAllMocks()

	let ctx: ReturnType<typeof getRuntimeFromContext>

	mockedFetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify([])))

	runtime = await initSvelteKitClientRuntime({
		fetch: mockedFetch,
		languageTag: "en",
		languageTags: ["en", "de"],
		sourceLanguageTag: "en",
	})

	vi.mock("$app/navigation", () => ({ goto: vi.fn() }))
	vi.mock("$app/environment", () => ({ browser: true }))
	vi.mock("$app/stores", () => ({ page: vi.fn() }))
	vi.mock("$app/paths", () => ({ base: "" }))
	vi.mock("svelte", () => ({ getContext: vi.fn(), setContext: vi.fn() }))
	vi.spyOn(svelte, "getContext").mockImplementation(() => ctx)
	vi.spyOn(svelte, "setContext").mockImplementation(
		(_, v) => (ctx = v as ReturnType<typeof getRuntimeFromContext>),
	)
	vi.mock("../../shared/utils.js", () => ({
		inlangSymbol: Symbol(""),
		replaceLanguageInUrl: vi.fn(),
	}))
})

describe("getRuntimeFromContext", () => {
	test("should return undefined if context was never set", async () => {
		expect(getRuntimeFromContext()).toBeUndefined()
	})
})

describe("addRuntimeToContext", () => {
	test("should set the runtime to the context", async () => {
		expect(addRuntimeToContext(runtime)).toBeUndefined()

		const r = getRuntimeFromContext()
		expect(r).toBeDefined()
	})

	test("should not change anything if changeLanguageTag gets called with the already set languageTag", async () => {
		expect(addRuntimeToContext(runtime)).toBeUndefined()

		const r = getRuntimeFromContext()
		const iBefore = get(r.i)

		expect(mockedFetch).toHaveBeenCalledTimes(1)
		expect(get(r.languageTag)).toBe("en")

		await r.changeLanguageTag("en")
		const iAfter = get(r.i)

		expect(mockedFetch).toHaveBeenCalledTimes(1)
		expect(get(r.languageTag)).toBe("en")
		expect(iAfter).toBe(iBefore)
	})

	test("should change the runtime values if changeLanguageTag gets called", async () => {
		expect(addRuntimeToContext(runtime)).toBeUndefined()

		const r = getRuntimeFromContext()
		const iBefore = get(r.i)

		expect(mockedFetch).toHaveBeenCalledTimes(1)
		expect(get(r.languageTag)).toBe("en")

		await r.changeLanguageTag("de")
		const iAfter = get(r.i)

		expect(mockedFetch).toHaveBeenCalledTimes(2)
		expect(get(r.languageTag)).toBe("de")
		expect(iAfter).not.toBe(iBefore)
	})

	test("should not refetch resource if it is already present", async () => {
		expect(addRuntimeToContext(runtime)).toBeUndefined()

		const r = getRuntimeFromContext()

		expect(mockedFetch).toHaveBeenCalledTimes(1)

		await r.loadMessages("de")
		expect(mockedFetch).toHaveBeenCalledTimes(2)

		await r.changeLanguageTag("de")

		expect(mockedFetch).toHaveBeenCalledTimes(2)
	})

	test("route function should return the same path", async () => {
		expect(addRuntimeToContext(runtime)).toBeUndefined()

		const r = getRuntimeFromContext()

		expect(r.route("/path/to/page")).toBe("/path/to/page")
	})
})
