import { assertNoImportsFromSdkJs } from "../../ast-transforms/utils/assertions.js"
import { codeToSourceFile } from "../../ast-transforms/utils/js.util.js"
import type { VirtualModule } from "../vite-plugin/config/index.js"
import { filePathForOutput } from "../vite-plugin/fileInformation.js"

export const transformServerJs = (filePath: string, config: VirtualModule, code: string) => {
	const sourceFile = codeToSourceFile(code, filePath)

	assertNoImportsFromSdkJs(sourceFile, filePathForOutput(config, filePath), "*.server.js")

	return code
}
