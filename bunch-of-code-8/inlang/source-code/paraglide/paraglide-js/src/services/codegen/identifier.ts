/**
 * Takes in a string and tries to convert it to a valid JS identifier.
 * The output is deterministic.
 *
 * "i" is short for "identifier".
 */
export function i(str: string) {
	str = str.replaceAll(/[^a-zA-Z0-9_]/g, "_")
	if (str[0]?.match(/[0-9]/)) {
		str = "_" + str
	}
	return str
}
