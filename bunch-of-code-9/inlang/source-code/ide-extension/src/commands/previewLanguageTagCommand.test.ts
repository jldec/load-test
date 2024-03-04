import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import * as settings from "../utilities/settings/index.js"
import { previewLanguageTagCommand } from "./previewLanguageTagCommand.js"
import { CONFIGURATION } from "../configuration.js"

describe("previewLanguageTagCommand", () => {
	beforeEach(() => {
		// Resetting the mocks before each test
		vi.resetAllMocks()

		// Setting up the mocks with inline functions
		vi.mock("vscode", () => ({
			window: { showQuickPick: vi.fn() },
			commands: { registerCommand: vi.fn() },
		}))
		vi.mock("../utilities/settings/index.js", () => ({ updateSetting: vi.fn() }))
		vi.mock("../utilities/settings/statusBar.js", () => ({ showStatusBar: vi.fn() }))
		vi.mock("../utilities/state.js", () => ({
			state: () => ({
				project: {
					settings: () => ({
						languageTags: ["en", "es", "fr"],
					}),
				},
			}),
		}))
		vi.mock("../configuration.js", () => ({
			CONFIGURATION: {
				EVENTS: {
					ON_DID_EDIT_MESSAGE: { fire: vi.fn() },
					ON_DID_EXTRACT_MESSAGE: { fire: vi.fn() },
					ON_DID_PREVIEW_LANGUAGE_TAG_CHANGE: { fire: vi.fn() },
				},
			},
		}))
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should register the command", () => {
		expect(previewLanguageTagCommand.command).toBe("inlang.previewLanguageTag")
		expect(previewLanguageTagCommand.title).toBe("Inlang: Change preview language tag")
		expect(previewLanguageTagCommand.register).toBe(vscode.commands.registerCommand)
	})

	it("should show language tags and update setting if a tag is selected", async () => {
		// Mocking the return value of showQuickPick
		// @ts-expect-error
		vi.mocked(vscode.window.showQuickPick).mockResolvedValue("en")

		await previewLanguageTagCommand.callback()

		expect(vscode.window.showQuickPick).toHaveBeenCalledWith(["en", "es", "fr"], {
			placeHolder: "Select a language",
		})
		expect(settings.updateSetting).toHaveBeenCalledWith("previewLanguageTag", "en")
		expect(CONFIGURATION.EVENTS.ON_DID_EDIT_MESSAGE.fire).toHaveBeenCalledTimes(1)
		expect(CONFIGURATION.EVENTS.ON_DID_EXTRACT_MESSAGE.fire).toHaveBeenCalledTimes(1)
		expect(CONFIGURATION.EVENTS.ON_DID_PREVIEW_LANGUAGE_TAG_CHANGE.fire).toHaveBeenCalledTimes(1)
	})

	it("should not update setting if no tag is selected", async () => {
		vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined)

		await previewLanguageTagCommand.callback()

		expect(settings.updateSetting).not.toHaveBeenCalled()
		expect(CONFIGURATION.EVENTS.ON_DID_EDIT_MESSAGE.fire).not.toHaveBeenCalled()
		expect(CONFIGURATION.EVENTS.ON_DID_EXTRACT_MESSAGE.fire).not.toHaveBeenCalled()
		expect(CONFIGURATION.EVENTS.ON_DID_PREVIEW_LANGUAGE_TAG_CHANGE.fire).not.toHaveBeenCalled()
	})
})
