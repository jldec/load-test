import { initLoadWrapper } from "@inlang/paraglide-js-sveltekit/adapter-sveltekit/shared"
import type { PageLoad } from "./$types.js"

export const load = initLoadWrapper<PageLoad>().use(async (_, { i }) => {
	console.info("+page.ts", i("welcome"))
})
