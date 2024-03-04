import type * as Kit from "@sveltejs/kit"
import type { RelativeUrl } from "../../../index.js"
import { detectLanguageTag } from "../../../detectors/detectLanguageTag.js"
import type { Detector } from "../../../detectors/types.js"
import { initSvelteKitServerRuntime, type SvelteKitServerRuntime } from "./runtime.js"
import { addRuntimeToLocals, getRuntimeFromLocals, initState } from "./state.js"
import { sequence } from "@sveltejs/kit/hooks"
import type { LanguageTag } from "@inlang/sdk"

// ------------------------------------------------------------------------------------------------

type WrappedHandle = (
	input: Parameters<Kit.Handle>[0],
	runtime: SvelteKitServerRuntime,
) => ReturnType<Kit.Handle>

type HandleOptions = {
	parseLanguageTag: (event: Kit.RequestEvent) => LanguageTag | undefined
	initDetectors?: (event: Kit.RequestEvent) => Detector[]
	redirect?: {
		throwable: typeof Kit.redirect
		getPath: (event: Kit.RequestEvent, languageTag: LanguageTag) => URL | string
	}
	excludedRoutes?: RelativeUrl[]
}

const initIsLanguage = (languageTags: LanguageTag[]) => (languageTag: string | undefined) =>
	languageTags.includes(languageTag as string)

export const initHandleWrapper = (options: HandleOptions) => ({
	use: (handle: WrappedHandle) => {
		let runtime: SvelteKitServerRuntime

		const excludedRoutes = [
			"/inlang", // inlang internal route
			"/[fallback]", // SvelteKit internal fallback route
			...(options.excludedRoutes || []), // user defined excluded routes
		]

		return sequence(
			async ({ event, resolve }: Parameters<Kit.Handle>[0]) => {
				const pathname = event.url.pathname as RelativeUrl

				runtime = getRuntimeFromLocals(event.locals)
				if (runtime) {
					// runtime was already added by a previous wrapper
					return resolve(event)
				}

				if (excludedRoutes.some((route) => pathname.startsWith(route))) {
					return resolve(event)
				}

				const { sourceLanguageTag, languageTags } = await initState()
				const isLanguage = initIsLanguage(languageTags)

				let languageTag = options.parseLanguageTag(event)
				if (!isLanguage(languageTag)) {
					if (options.redirect) {
						const detectedLanguageTag = await detectLanguageTag(
							{ sourceLanguageTag, languageTags },
							...(options.initDetectors ? options.initDetectors(event) : []),
						)

						throw options.redirect.throwable(
							307,
							options.redirect.getPath(event, detectedLanguageTag).toString(),
						)
					}

					languageTag = undefined
				}

				runtime = initSvelteKitServerRuntime({
					sourceLanguageTag,
					languageTags,
					languageTag,
				})

				addRuntimeToLocals(event.locals, runtime)

				return resolve(event, {
					transformPageChunk: languageTag
						? async ({ html }) => html.replace("<html", `<html lang="${languageTag}"`)
						: undefined,
				})
			},
			(input) => (handle as WrappedHandle)(input, runtime),
		)
	},
})

// ------------------------------------------------------------------------------------------------

export type LayoutServerDataPayload = {
	"[inlang]"?: {
		sourceLanguageTag: LanguageTag
		languageTags: LanguageTag[]
		languageTag: LanguageTag | undefined
	}
}

export const initRootLayoutServerLoadWrapper = <
	LayoutServerLoad extends Kit.ServerLoad<any, any, any, any>,
>() => ({
	use:
		<Data extends Record<string, any> | void>(
			load: (
				event: Parameters<LayoutServerLoad>[0],
				runtime: SvelteKitServerRuntime,
			) => Promise<Data> | Data,
		) =>
		async (event: Parameters<LayoutServerLoad>[0]): Promise<Data & LayoutServerDataPayload> => {
			const runtime = getRuntimeFromLocals(event.locals)

			// TODO: only insert if languageTag detection strategy url is used
			event.params.lang

			return {
				...(await load(event, runtime)),
				...(runtime
					? {
							"[inlang]": {
								sourceLanguageTag: runtime.sourceLanguageTag, // TODO: only pass this if `sourceLanguageTag` gets used somewhere or detection strategy is on client. If removed we need to find a new heuristic to detect excluded routes
								languageTags: runtime.languageTags, // TODO: only pass this if `languageTags` get used somewhere
								languageTag: runtime.languageTag, // TODO: only pass this if `languageTag` gets detected on server
							},
					  }
					: undefined),
			}
		},
})

// ------------------------------------------------------------------------------------------------

const initGenericServerWrapper = <Event extends Kit.RequestEvent>() => ({
	use:
		<Data extends Record<string, any> | void>(
			fn: (event: Event, runtime: SvelteKitServerRuntime) => Promise<Data> | Data,
		) =>
		async (event: Event): Promise<Data> => {
			const runtime = getRuntimeFromLocals(event.locals)

			return fn(event, runtime)
		},
})

export const initServerLoadWrapper = <ServerLoad extends Kit.ServerLoad<any, any, any, any>>() =>
	initGenericServerWrapper<Parameters<ServerLoad>[0]>()

export const initActionWrapper = <Action extends Kit.Action<any, any, any>>() =>
	initGenericServerWrapper<Parameters<Action>[0]>()

export const initRequestHandlerWrapper = <RequestHandler extends Kit.RequestHandler<any, any>>() =>
	initGenericServerWrapper<Parameters<RequestHandler>[0]>()
