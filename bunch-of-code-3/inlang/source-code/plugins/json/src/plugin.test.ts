/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect, it, describe } from "vitest"
import type { PluginSettings } from "./settings.js"
import { Message, ProjectSettings, Variant, createVariant, getVariant } from "@inlang/sdk"
import { plugin } from "./plugin.js"
import { createNodeishMemoryFs } from "@lix-js/fs"

const pluginId = "plugin.inlang.json"

describe("loadMessage", () => {
	it("should return messages if the path pattern is valid", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({ test: "Hello world" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		const variant = getVariant(messages[0]!, { where: { languageTag: "en" } })
		expect(variant?.pattern[0]?.type).toBe("Text")
	})

	it("should work with empty json files", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({}))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		expect(plugin.loadMessages!({ settings, nodeishFs: fs })).resolves.toBeTruthy()
	})

	it("should work with not yet existing files", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({ test: "Hello world" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		expect(plugin.loadMessages!({ settings, nodeishFs: fs })).resolves.toBeTruthy()
	})

	it("should add multible variants to the same message", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({ test: "Hello world" }))
		await fs.writeFile("./de.json", JSON.stringify({ test: "Hallo welt" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })).toBeTruthy()
		expect(getVariant(messages[0]!, { where: { languageTag: "de" } })).toBeTruthy()
	})

	// namespaces
	it("should return messages if the path pattern is valid (namespace)", async () => {
		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.writeFile("./en/common.json", JSON.stringify({ test: "Hello world" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		const variant = getVariant(messages[0]!, { where: { languageTag: "en" } })
		expect(variant?.pattern[0]?.type).toBe("Text")
	})

	it("should work with empty json files (namespace)", async () => {
		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.writeFile("./en/common.json", JSON.stringify({}))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		expect(plugin.loadMessages!({ settings, nodeishFs: fs })).resolves.toBeTruthy()
	})

	it("should work with not yet existing files (namespace)", async () => {
		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.writeFile("./en/common.json", JSON.stringify({ test: "Hello world" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		expect(plugin.loadMessages!({ settings, nodeishFs: fs })).resolves.toBeTruthy()
	})

	it("should add multible variants to the same message (namespace)", async () => {
		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.mkdir("./de")
		await fs.writeFile("./en/common.json", JSON.stringify({ test: "Hello world" }))
		await fs.writeFile("./de/common.json", JSON.stringify({ test: "Hallo welt" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })).toBeTruthy()
		expect(getVariant(messages[0]!, { where: { languageTag: "de" } })).toBeTruthy()
	})

	it("should not throw an error when load messages with empty namespaces", async () => {
		const test = JSON.stringify({
			test: "test",
		})
		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.mkdir("./de")
		await fs.writeFile("./en/common.json", test)
		await fs.writeFile("./en/vital.json", test)
		await fs.writeFile("./de/common.json", test)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
					vital: "./{languageTag}/vital.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		let isThrown = false
		try {
			await plugin.loadMessages!({
				settings,
				nodeishFs: fs,
			})
		} catch (e) {
			isThrown = true
		}
		expect(isThrown).toBe(false)
	})

	it("should get the correct languages, when single namespace is defined as a pathPattern string 'pathPattern: `public/locales/{languageTag}/translation.json`'", async () => {
		const test = JSON.stringify({
			test: "test",
		})
		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.mkdir("./de")
		await fs.writeFile("./en/common.json", test)
		await fs.writeFile("./de/common.json", test)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					pathPattern: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		let isThrown = false
		try {
			await plugin.loadMessages!({
				settings,
				nodeishFs: fs,
			})
		} catch (e) {
			isThrown = true
		}
		expect(isThrown).toBe(false)
	})

	it("should not throw an error when the path to the resources is not present", async () => {
		const fs = createNodeishMemoryFs()

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: "./lang/{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		let isThrown = false
		try {
			await plugin.loadMessages!({
				settings,
				nodeishFs: fs,
			})
		} catch (e) {
			isThrown = true
		}
		expect(isThrown).toBe(false)
	})
})

describe("saveMessage", () => {
	it("test string pathPattern", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({}))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages: Message[] = [
			{
				id: "test",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "Hello world",
							},
						],
					},
				],
			},
		]
		await plugin.saveMessages!({ messages, settings, nodeishFs: fs })
	})

	it("test object pathPattern", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({}))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages: Message[] = [
			{
				id: "common:test",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "Hello world",
							},
						],
					},
				],
			},
			{
				id: "common:test2",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "Hello world2",
							},
						],
					},
				],
			},
		]
		await plugin.saveMessages!({ messages, settings, nodeishFs: fs })
	})
})

describe("variable reference", () => {
	it("should correctly identify variable reference (at the end)", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({ test: "Hello {username}" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern.length).toBe(2)
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern[0]?.type).toBe(
			"Text"
		)
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern[1]?.type).toBe(
			"VariableReference"
		)
	})

	it("should correctly identify variable reference (at the beginning)", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({ test: "{username} the great" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern.length).toBe(2)
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern[0]?.type).toBe(
			"VariableReference"
		)
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern[1]?.type).toBe(
			"Text"
		)
	})

	it("should correctly apply the variableReferencePattern", async () => {
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", JSON.stringify({ test: "Hello @username" }))

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
				variableReferencePattern: ["@"],
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern[0]?.type).toBe(
			"Text"
		)
		expect(getVariant(messages[0]!, { where: { languageTag: "en" } })?.pattern[1]?.type).toBe(
			"VariableReference"
		)
	})
})

describe("formatting", () => {
	it("should preserve the spacing of the source language and determine the spacing for new language resources", async () => {
		// @prettier-ignore
		const with4Spaces = `{
    "test": "test"
}`

		// @prettier-ignore
		const withTabs = `{
	"test": "test"
}`

		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", with4Spaces)
		await fs.writeFile("./fr.json", with4Spaces)
		await fs.writeFile("./de.json", withTabs)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de", "fr"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		const variant: Variant = {
			languageTag: "es",
			match: [],
			pattern: [
				{
					type: "Text",
					value: "test",
				},
			],
		}
		const newMessage = createVariant(messages[0]!, {
			data: variant,
		}).data
		await plugin.saveMessages!({ messages: [newMessage!], settings, nodeishFs: fs })

		const file1 = await fs.readFile("./en.json", { encoding: "utf-8" })
		const file2 = await fs.readFile("./fr.json", { encoding: "utf-8" })
		const file3 = await fs.readFile("./de.json", { encoding: "utf-8" })
		const file4 = await fs.readFile("./es.json", { encoding: "utf-8" })

		expect(file1).toBe(with4Spaces)
		expect(file2).toBe(with4Spaces)
		expect(file3).toBe(with4Spaces)
		expect(file4).toBe(with4Spaces)
	})

	it("should preserve the 'ends with new line' of the source language and determine it for new language resources", async () => {
		// @prettier-ignore
		const withNewLine = `{
	"test": "test"
}
`

		// @prettier-ignore
		const withoutNewLine = `{
	"test": "test"
}`

		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", withNewLine)
		await fs.writeFile("./fr.json", withoutNewLine)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de", "fr"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		await plugin.saveMessages!({ messages, settings, nodeishFs: fs })
		const file1 = await fs.readFile("./en.json", { encoding: "utf-8" })
		const file2 = await fs.readFile("./fr.json", { encoding: "utf-8" })
		expect(file1).toBe(withNewLine)
		expect(file2).toBe(withNewLine)
	})

	it("should escape `.` in flattened json structures", async () => {
		const enResource = `{
    "test.": "test",
	"test.test": "test"
}`

		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.writeFile("./en/common.json", enResource)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: { common: "./{languageTag}/common.json" },
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		const reference: Message[] = [
			{
				id: "common:test.",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "test",
							},
						],
					},
				],
			},
			{
				id: "common:test.test",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "test",
							},
						],
					},
				],
			},
		]

		expect(messages).toStrictEqual(reference)
	})

	it("should escape `.` in nested json structures", async () => {
		const enResource = `{
	"a.": {
		"b": "test"
	},
	"c.": "test"
}`

		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.writeFile("./en/common.json", enResource)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		const reference: Message[] = [
			{
				id: "common:a..b",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "test",
							},
						],
					},
				],
			},
			{
				id: "common:c.",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "test",
							},
						],
					},
				],
			},
		]
		expect(messages).toStrictEqual(reference)
		await plugin.saveMessages!({
			messages,
			settings,
			nodeishFs: fs,
		})
		const file = await fs.readFile("./en/common.json", { encoding: "utf-8" })
		const json = JSON.parse(file as string)
		expect(json["a."].b).toStrictEqual("test")
		expect(json["c."]).toStrictEqual("test")
	})

	it("should handle empty objects correctly", async () => {
		const content = JSON.stringify(
			{
				a: "test",
				b: {},
			},
			undefined,
			2
		)
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", content)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})

		await plugin.saveMessages!({
			messages: messages,
			settings,
			nodeishFs: fs,
		})

		const newContent = await fs.readFile("./en.json", { encoding: "utf-8" })

		expect(JSON.parse(newContent).b).toBeUndefined()
	})

	it("should correctly detect the nesting in the source file and determine for new ones", async () => {
		const withNesting = JSON.stringify(
			{
				test: {
					test: "test",
				},
			},
			undefined,
			2
		)

		const withoutNesting = JSON.stringify(
			{
				"test.test": "test",
			},
			undefined,
			4
		)

		const fs = createNodeishMemoryFs()

		await fs.writeFile("./en.json", withNesting)
		await fs.writeFile("./fr.json", withNesting)
		await fs.writeFile("./de.json", withoutNesting)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en", "de", "fr"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})

		messages.push({
			id: "test.test",
			selectors: [],
			variants: [
				{
					languageTag: "es",
					match: [],
					pattern: [
						{
							type: "Text",
							value: "test",
						},
					],
				},
			],
		})

		await plugin.saveMessages!({
			messages,
			settings,
			nodeishFs: fs,
		})

		const file1 = await fs.readFile("./en.json", { encoding: "utf-8" })
		const file2 = await fs.readFile("./fr.json", { encoding: "utf-8" })
		const file3 = await fs.readFile("./de.json", { encoding: "utf-8" })
		const file4 = await fs.readFile("./es.json", { encoding: "utf-8" })

		expect(file1).toBe(withNesting)
		expect(file2).toBe(withNesting)
		expect(file3).toBe(withNesting)
		expect(file4).toBe(withNesting)
	})
})

describe("roundTrip", () => {
	it("should serialize newly added messages", async () => {
		const enResource = `{
	"test": "{username}"
}`

		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", enResource)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: "./{languageTag}.json",
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		const variant: Variant = {
			languageTag: "en",
			match: [],
			pattern: [
				{
					type: "Text",
					value: "This is new",
				},
			],
		}
		const newMessage: Message = {
			id: "test2",
			selectors: [],
			variants: [variant],
		}
		messages.push(newMessage)
		await plugin.saveMessages!({
			messages,
			settings,
			nodeishFs: fs,
		})
		const newFile = (await fs.readFile("./en.json", { encoding: "utf-8" })) as string
		const json = JSON.parse(newFile)
		expect(json.test).toBe("{username}")
		expect(json.test2).toBe("This is new")
	})

	it("should correctly parse resources with pathPattern that contain namespaces", async () => {
		const testResource = `{
	"test": "test"
}`

		const fs = createNodeishMemoryFs()
		await fs.mkdir("./en")
		await fs.writeFile("./en/common.json", testResource)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}/common.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		const reference: Message[] = [
			{
				id: "common:test",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{
								type: "Text",
								value: "test",
							},
						],
					},
				],
			},
		]
		expect(messages).toStrictEqual(reference)
	})

	it("should successfully do a roundtrip with complex content", async () => {
		const complexContent = JSON.stringify(
			{
				"//multiLineString": {
					multiline: "This is a\nmulti-line\nstring.",
				},
				unicodeCharacters: {
					emoji: "\uD83D\uDE00",
					currency: "€",
				},
				test: 'Single "quote" test',
			},
			undefined,
			4
		)
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", complexContent)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		plugin.saveMessages!({ messages, settings, nodeishFs: fs })
		const newMessage = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		expect(newMessage).toStrictEqual(messages)
	})

	it("should successfully do a roundtrip with empty message value", async () => {
		const test = JSON.stringify({
			test: "",
		})
		const fs = createNodeishMemoryFs()
		await fs.writeFile("./en.json", test)

		const settings = {
			sourceLanguageTag: "en",
			languageTags: ["en"],
			modules: [],
			[pluginId]: {
				pathPattern: {
					common: "./{languageTag}.json",
				},
			} satisfies PluginSettings,
		} satisfies ProjectSettings

		const messages = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		plugin.saveMessages!({ messages, settings, nodeishFs: fs })
		const newMessage = await plugin.loadMessages!({
			settings,
			nodeishFs: fs,
		})
		expect(newMessage).toStrictEqual(messages)
	})
})
