import type { NodeishFilesystemSubset } from "@inlang/plugin"

/**
 * Wraps the nodeish filesystem subset with a function that intercepts paths
 * and prepends the base path.
 *
 * The paths are resolved from the `projectPath` argument.
 */
export const createNodeishFsWithWatcher = (args: {
	nodeishFs: NodeishFilesystemSubset
	updateMessages: () => void
}): NodeishFilesystemSubset => {
	const pathList: string[] = []

	const makeWatcher = (path: string) => {
		const abortController = new AbortController()
		;(async () => {
			try {
				const watcher = args.nodeishFs.watch(path, {
					signal: abortController.signal,
					persistent: false,
				})
				if (watcher) {
					//eslint-disable-next-line @typescript-eslint/no-unused-vars
					for await (const event of watcher) {
						args.updateMessages()
					}
				}
			} catch (err: any) {
				if (err.name === "AbortError") return
				// https://github.com/opral/monorepo/issues/1647
				// the file does not exist (yet)
				// this is not testable beacause the fs.watch api differs
				// from node and lix. lenghty
				else if (err.code === "ENOENT") return
				throw err
			}
		})()
	}

	const readFileAndExtractPath = (path: string, options: { encoding: "utf-8" | "binary" }) => {
		if (!pathList.includes(path)) {
			makeWatcher(path)
			pathList.push(path)
		}
		return args.nodeishFs.readFile(path, options)
	}

	return {
		// @ts-expect-error
		readFile: (path: string, options: { encoding: "utf-8" | "binary" }) =>
			readFileAndExtractPath(path, options),
		readdir: args.nodeishFs.readdir,
		mkdir: args.nodeishFs.mkdir,
		writeFile: args.nodeishFs.writeFile,
		watch: args.nodeishFs.watch,
	}
}
