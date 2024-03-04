import type { SourceFile } from "ts-morph"
import { isSdkImportPresent } from "./imports.js"
import dedent from "dedent"
import { InlangSdkException } from "../../adapter-sveltekit/vite-plugin/exceptions.js"
import type { FileType } from "../../adapter-sveltekit/vite-plugin/fileInformation.js"

// TODO: test
export const assertNoImportsFromSdkJs = (
	sourceFile: SourceFile,
	filePath: string,
	type: FileType,
	root = false,
) => {
	if (isSdkImportPresent(sourceFile)) {
		throw new InlangSdkException(dedent`
			It is currently not supported to import something from '@inlang/paraglide-js-sveltekit' in this file (${filePath}).
			Please read the docs for more information on how to workaround this temporary limitation:
			https://inlang.com/documentation/sdk/sveltekit/advanced${getSection(type, root)}
		`)
	}
}

const getSection = (type: FileType, root: boolean) => {
	if (root) {
		switch (type) {
			case "+layout.server.js":
				return "#/routes/+layout.server.js-(root server layout)"
			case "+layout.js":
				return "#/routes/+layout.js-(root layout)"
			case "+page.js":
				return "#/routes/+page.js-(root page)"
			case "+layout.svelte":
				return "#/routes/+layout.svelte-(root svelte layout)"
		}
	}

	switch (type) {
		case "*.server.js":
		case "*.js":
			return "#*.js"
		case "+layout.svelte":
		case "+page.svelte":
		case "*.svelte":
			return "#*.svelte"
		case "[languageTag].json":
		case "+layout.server.js":
		case "+layout.js":
		case "hooks.server.js":
		case "+server.js":
		case "+page.server.js":
		case "+page.js":
			return ""
		default:
			return unreachable(type)
	}
}

export const unreachable = (value: never): never => {
	throw new Error(`unhandled case '${value}'`)
}
