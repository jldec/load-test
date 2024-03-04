import { test, expect } from "vitest"
import { PluginSettings } from "./settings.js"
import { Value } from "@sinclair/typebox/value"

test("the file path pattern must end with .json", () => {
	const valid = [
		"./messages/{languageTag}.json",
		"./src/i18n/{languageTag}.json",
		"./translations/{languageTag}.json",
	]
	const invalid = ["./messages/{languageTag}.json.txt", "./messages/{languageTag}.js"]
	for (const path of valid) {
		expect(Value.Check(PluginSettings, { pathPattern: path } satisfies PluginSettings)).toBe(true)
	}
	for (const path of invalid) {
		expect(Value.Check(PluginSettings, { pathPattern: path } satisfies PluginSettings)).toBe(false)
	}
})

test("the file path pattern must contain the {languageTag} placeholder", () => {
	const valid = [
		"./messages/{languageTag}.json",
		"./src/i18n/{languageTag}.json",
		"./translations/{languageTag}.json",
	]
	const invalid = ["./messages/messages.json", "./messages/{language}.json"]
	for (const path of valid) {
		expect(Value.Check(PluginSettings, { pathPattern: path } satisfies PluginSettings)).toBe(true)
	}
	for (const path of invalid) {
		expect(Value.Check(PluginSettings, { pathPattern: path } satisfies PluginSettings)).toBe(false)
	}
})

test("it should be possible to use an absolute path", () => {
	const settings = {
		pathPattern: "/home/{languageTag}.json",
	} satisfies PluginSettings
	expect(Value.Check(PluginSettings, settings)).toBe(true)
})

test("it should be possible to use a relative path", () => {
	const settings = {
		pathPattern: "./home/{languageTag}.json",
	} satisfies PluginSettings
	expect(Value.Check(PluginSettings, settings)).toBe(true)
})

test("it should be possible to use parent directories in the storage path", () => {
	const settings = {
		pathPattern: "../home/{languageTag}.json",
	} satisfies PluginSettings
	expect(Value.Check(PluginSettings, settings)).toBe(true)
})
