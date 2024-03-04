/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type {
	InlangProject,
	InstalledMessageLintRule,
	InstalledPlugin,
	Subscribable,
} from "./api.js"
import { type ImportFunction, resolveModules } from "./resolve-modules/index.js"
import { TypeCompiler, ValueErrorType } from "@sinclair/typebox/compiler"
import {
	ProjectSettingsFileJSONSyntaxError,
	ProjectSettingsFileNotFoundError,
	ProjectSettingsInvalidError,
	PluginLoadMessagesError,
	PluginSaveMessagesError,
	LoadProjectInvalidArgument,
} from "./errors.js"
import { createRoot, createSignal, createEffect } from "./reactivity/solid.js"
import { createMessagesQuery } from "./createMessagesQuery.js"
import { debounce } from "throttle-debounce"
import { createMessageLintReportsQuery } from "./createMessageLintReportsQuery.js"
import { ProjectSettings, Message, type NodeishFilesystemSubset } from "./versionedInterfaces.js"
import { tryCatch, type Result } from "@inlang/result"
import { migrateIfOutdated } from "@inlang/project-settings/migration"
import { createNodeishFsWithAbsolutePaths } from "./createNodeishFsWithAbsolutePaths.js"
import { normalizePath } from "@lix-js/fs"
import { isAbsolutePath } from "./isAbsolutePath.js"
import { createNodeishFsWithWatcher } from "./createNodeishFsWithWatcher.js"
import { maybeMigrateToDirectory } from "./migrations/migrateToDirectory.js"
import { maybeCreateFirstProjectId } from "./migrations/maybeCreateFirstProjectId.js"
import type { Repository } from "@lix-js/client"
import { capture } from "./telemetry/capture.js"
import { identifyProject } from "./telemetry/groupIdentify.js"

const settingsCompiler = TypeCompiler.Compile(ProjectSettings)

/**
 * @param projectPath - Absolute path to the inlang settings file.
 * @param repo - An instance of a lix repo as returned by `openRepository`.
 * @param _import - Use `_import` to pass a custom import function for testing,
 *   and supporting legacy resolvedModules such as CJS.
 * @param appId - The app id to use for telemetry e.g "app.inlang.badge"
 *
 */
export async function loadProject(args: {
	projectPath: string
	repo: Repository
	appId?: string
	_import?: ImportFunction
}): Promise<InlangProject> {
	const projectPath = normalizePath(args.projectPath)

	// -- validation --------------------------------------------------------
	// the only place where throwing is acceptable because the project
	// won't even be loaded. do not throw anywhere else. otherwise, apps
	// can't handle errors gracefully.

	if (!isAbsolutePath(args.projectPath)) {
		throw new LoadProjectInvalidArgument(
			`Expected an absolute path but received "${args.projectPath}".`,
			{ argument: "projectPath" }
		)
	} else if (/[^\\/]+\.inlang$/.test(projectPath) === false) {
		throw new LoadProjectInvalidArgument(
			`Expected a path ending in "{name}.inlang" but received "${projectPath}".\n\nValid examples: \n- "/path/to/micky-mouse.inlang"\n- "/path/to/green-elephant.inlang\n`,
			{ argument: "projectPath" }
		)
	}

	const fs = args.repo.nodeishFs

	const nodeishFs = createNodeishFsWithAbsolutePaths({
		projectPath,
		nodeishFs: fs,
	})

	// -- migratations ------------------------------------------------

	await maybeMigrateToDirectory({ nodeishFs: fs, projectPath })
	await maybeCreateFirstProjectId({ projectPath, repo: args.repo })

	// -- load project ------------------------------------------------------

	return await createRoot(async () => {
		// TODO remove tryCatch after https://github.com/opral/monorepo/issues/2013
		// - a repo will always be present
		// - if a repo is present, the project id will always be present
		const { data: projectId } = await tryCatch(() =>
			fs.readFile(args.projectPath + "/project_id", { encoding: "utf-8" })
		)

		const [initialized, markInitAsComplete, markInitAsFailed] = createAwaitable()
		// -- settings ------------------------------------------------------------

		const [settings, _setSettings] = createSignal<ProjectSettings>()
		createEffect(() => {
			// TODO:
			// if (projectId) {
			// 	telemetryBrowser.group("project", projectId, {
			// 		name: projectId,
			// 	})
			// }

			loadSettings({ settingsFilePath: projectPath + "/settings.json", nodeishFs })
				.then((settings) => setSettings(settings))
				.catch((err) => {
					markInitAsFailed(err)
				})
		})
		// TODO: create FS watcher and update settings on change

		const writeSettingsToDisk = skipFirst((settings: ProjectSettings) =>
			_writeSettingsToDisk({ nodeishFs, settings, projectPath })
		)

		const setSettings = (settings: ProjectSettings): Result<void, ProjectSettingsInvalidError> => {
			try {
				const validatedSettings = parseSettings(settings)
				_setSettings(validatedSettings)

				writeSettingsToDisk(validatedSettings)
				return { data: undefined }
			} catch (error: unknown) {
				if (error instanceof ProjectSettingsInvalidError) {
					return { error }
				}

				throw new Error(
					"Unhandled error in setSettings. This is an internal bug. Please file an issue."
				)
			}
		}

		// -- resolvedModules -----------------------------------------------------------

		const [resolvedModules, setResolvedModules] =
			createSignal<Awaited<ReturnType<typeof resolveModules>>>()

		createEffect(() => {
			const _settings = settings()
			if (!_settings) return

			resolveModules({ settings: _settings, nodeishFs, _import: args._import })
				.then((resolvedModules) => {
					setResolvedModules(resolvedModules)
				})
				.catch((err) => markInitAsFailed(err))
		})

		// -- messages ----------------------------------------------------------

		let settingsValue: ProjectSettings
		createEffect(() => (settingsValue = settings()!)) // workaround to not run effects twice (e.g. settings change + modules change) (I'm sure there exists a solid way of doing this, but I haven't found it yet)

		// please don't use this as source of truth, use the query instead
		// needed for granular linting
		const [messages, setMessages] = createSignal<Message[]>()

		createEffect(() => {
			const _resolvedModules = resolvedModules()
			if (!_resolvedModules) return

			if (!_resolvedModules.resolvedPluginApi.loadMessages) {
				markInitAsFailed(undefined)
				return
			}

			const loadAndSetMessages = async (fs: NodeishFilesystemSubset) => {
				makeTrulyAsync(
					_resolvedModules.resolvedPluginApi.loadMessages({
						settings: settingsValue,
						nodeishFs: fs,
					})
				)
					.then((messages) => {
						setMessages(messages)
						markInitAsComplete()
					})
					.catch((err) => markInitAsFailed(new PluginLoadMessagesError({ cause: err })))
			}

			const fsWithWatcher = createNodeishFsWithWatcher({
				nodeishFs: nodeishFs,
				updateMessages: () => {
					loadAndSetMessages(nodeishFs)
				},
			})

			loadAndSetMessages(fsWithWatcher)
		})

		// -- installed items ----------------------------------------------------

		const installedMessageLintRules = () => {
			if (!resolvedModules()) return []
			return resolvedModules()!.messageLintRules.map(
				(rule) =>
					({
						id: rule.id,
						displayName: rule.displayName,
						description: rule.description,
						module:
							resolvedModules()?.meta.find((m) => m.id.includes(rule.id))?.module ??
							"Unknown module. You stumbled on a bug in inlang's source code. Please open an issue.",
						// default to warning, see https://github.com/opral/monorepo/issues/1254
						level: settingsValue["messageLintRuleLevels"]?.[rule.id] ?? "warning",
					} satisfies InstalledMessageLintRule)
			) satisfies Array<InstalledMessageLintRule>
		}

		const installedPlugins = () => {
			if (!resolvedModules()) return []
			return resolvedModules()!.plugins.map((plugin) => ({
				id: plugin.id,
				displayName: plugin.displayName,
				description: plugin.description,
				module:
					resolvedModules()?.meta.find((m) => m.id.includes(plugin.id))?.module ??
					"Unknown module. You stumbled on a bug in inlang's source code. Please open an issue.",
			})) satisfies Array<InstalledPlugin>
		}

		// -- app ---------------------------------------------------------------

		const initializeError: Error | undefined = await initialized.catch((error) => error)

		const abortController = new AbortController()
		const hasWatcher = nodeishFs.watch("/", { signal: abortController.signal }) !== undefined

		const messagesQuery = createMessagesQuery(() => messages() || [])
		const lintReportsQuery = createMessageLintReportsQuery(
			messagesQuery,
			settings as () => ProjectSettings,
			installedMessageLintRules,
			resolvedModules,
			hasWatcher
		)

		const debouncedSave = skipFirst(
			debounce(
				500,
				async (newMessages) => {
					try {
						if (JSON.stringify(newMessages) !== JSON.stringify(messages())) {
							await resolvedModules()?.resolvedPluginApi.saveMessages({
								settings: settingsValue,
								messages: newMessages,
							})
						}
					} catch (err) {
						throw new PluginSaveMessagesError({
							cause: err,
						})
					}
					const abortController = new AbortController()
					if (
						newMessages.length !== 0 &&
						JSON.stringify(newMessages) !== JSON.stringify(messages()) &&
						nodeishFs.watch("/", { signal: abortController.signal }) !== undefined
					) {
						setMessages(newMessages)
					}
				},
				{ atBegin: false }
			)
		)

		createEffect(() => {
			debouncedSave(messagesQuery.getAll())
		})

		/**
		 * Utility to escape reactive tracking and avoid multiple calls to
		 * the capture event.
		 *
		 * Should be addressed with https://github.com/opral/monorepo/issues/1772
		 */
		let projectLoadedCapturedAlready = false

		if (projectId && projectLoadedCapturedAlready === false) {
			projectLoadedCapturedAlready = true
			// TODO ensure that capture is "awaited" without blocking the the app from starting
			await identifyProject({
				projectId,
				properties: {
					// using the id for now as a name but can be changed in the future
					// we need at least one property to make a project visible in the dashboard
					name: projectId,
				},
			})
			await capture("SDK loaded project", {
				projectId,
				properties: {
					appId: args.appId,
					settings: settings(),
					installedPluginIds: installedPlugins().map((p) => p.id),
					installedMessageLintRuleIds: installedMessageLintRules().map((r) => r.id),
					numberOfMessages: messagesQuery.includedMessageIds().length,
				},
			})
		}

		return {
			id: projectId,
			installed: {
				plugins: createSubscribable(() => installedPlugins()),
				messageLintRules: createSubscribable(() => installedMessageLintRules()),
			},
			errors: createSubscribable(() => [
				...(initializeError ? [initializeError] : []),
				...(resolvedModules() ? resolvedModules()!.errors : []),
			]),
			settings: createSubscribable(() => settings() as ProjectSettings),
			setSettings,
			customApi: createSubscribable(() => resolvedModules()?.resolvedPluginApi.customApi || {}),
			query: {
				messages: messagesQuery,
				messageLintReports: lintReportsQuery,
			},
		} satisfies InlangProject
	})
}

//const x = {} as InlangProject

// ------------------------------------------------------------------------------------------------

const loadSettings = async (args: {
	settingsFilePath: string
	nodeishFs: NodeishFilesystemSubset
}) => {
	const { data: settingsFile, error: settingsFileError } = await tryCatch(
		async () => await args.nodeishFs.readFile(args.settingsFilePath, { encoding: "utf-8" })
	)
	if (settingsFileError)
		throw new ProjectSettingsFileNotFoundError({
			cause: settingsFileError,
			path: args.settingsFilePath,
		})

	const json = tryCatch(() => JSON.parse(settingsFile!))

	if (json.error) {
		throw new ProjectSettingsFileJSONSyntaxError({
			cause: json.error,
			path: args.settingsFilePath,
		})
	}
	return parseSettings(json.data)
}

const parseSettings = (settings: unknown) => {
	const withMigration = migrateIfOutdated(settings as any)
	if (settingsCompiler.Check(withMigration) === false) {
		const typeErrors = [...settingsCompiler.Errors(settings)]
		if (typeErrors.length > 0) {
			throw new ProjectSettingsInvalidError({
				errors: typeErrors,
			})
		}
	}

	const { sourceLanguageTag, languageTags } = settings as ProjectSettings
	if (!languageTags.includes(sourceLanguageTag)) {
		throw new ProjectSettingsInvalidError({
			errors: [
				{
					message: `The sourceLanguageTag "${sourceLanguageTag}" is not included in the languageTags "${languageTags.join(
						'", "'
					)}". Please add it to the languageTags.`,
					type: ValueErrorType.String,
					schema: ProjectSettings,
					value: sourceLanguageTag,
					path: "sourceLanguageTag",
				},
			],
		})
	}

	return withMigration
}

const _writeSettingsToDisk = async (args: {
	projectPath: string
	nodeishFs: NodeishFilesystemSubset
	settings: ProjectSettings
}) => {
	const { data: serializedSettings, error: serializeSettingsError } = tryCatch(() =>
		// TODO: this will probably not match the original formatting
		JSON.stringify(args.settings, undefined, 2)
	)
	if (serializeSettingsError) {
		throw serializeSettingsError
	}

	const { error: writeSettingsError } = await tryCatch(async () =>
		args.nodeishFs.writeFile(args.projectPath + "/settings.json", serializedSettings)
	)

	if (writeSettingsError) {
		throw writeSettingsError
	}
}

// ------------------------------------------------------------------------------------------------

const createAwaitable = () => {
	let resolve: () => void
	let reject: () => void

	const promise = new Promise<void>((res, rej) => {
		resolve = res
		reject = rej
	})

	return [promise, resolve!, reject!] as [
		awaitable: Promise<void>,
		resolve: () => void,
		reject: (e: unknown) => void
	]
}

// ------------------------------------------------------------------------------------------------

// TODO: create global util type
type MaybePromise<T> = T | Promise<T>

const makeTrulyAsync = <T>(fn: MaybePromise<T>): Promise<T> => (async () => fn)()

// Skip initial call, eg. to skip setup of a createEffect
function skipFirst(func: (args: any) => any) {
	let initial = false
	return function (...args: any) {
		if (initial) {
			// @ts-ignore
			return func.apply(this, args)
		}
		initial = true
	}
}

export function createSubscribable<T>(signal: () => T): Subscribable<T> {
	return Object.assign(signal, {
		subscribe: (callback: (value: T) => void) => {
			createEffect(() => {
				callback(signal())
			})
		},
	})
}
