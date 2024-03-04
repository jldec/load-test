/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Using parsimmon because:
 *
 * 1. Chevrotain is too complicated.
 * 2. TypeScript's compiler doesn't work in the browser.
 * 3. TypeScripts compiler
 */

import Parsimmon from "parsimmon"
// import type { MessageReferenceMatch } from "@inlang/plugin"

const parser = Parsimmon.createLanguage({
	// The entry point for message reference matching.
	//
	// 1. Match a t function call or any other character.
	// 2. Match as many of these as possible.
	// 3. Filter out any non-object matches.
	entry: (r) => {
		return Parsimmon.alt(r.FunctionCall!, Parsimmon.any)
			.many()
			.map((matches) => {
				// filter arbitrary characters
				return matches.filter((match) => typeof match === "object")
			})
	},

	// A string literal is either a single or double quoted string
	stringLiteral: (r) => {
		return Parsimmon.alt(r.doubleQuotedString!, r.singleQuotedString!)
	},

	// Double quoted string literal parser
	//
	// 1. Start with a double quote.
	// 2. Then match any character that is not a double quote.
	// 3. End with a double quote.
	doubleQuotedString: () => {
		return Parsimmon.string('"').then(Parsimmon.regex(/[^"]*/)).skip(Parsimmon.string('"'))
	},

	// Single quoted string literal parser
	//
	// 1. Start with a single quote.
	// 2. Then match any character that is not a single quote.
	// 3. End with a single quote.
	singleQuotedString: () => {
		return Parsimmon.string("'").then(Parsimmon.regex(/[^']*/)).skip(Parsimmon.string("'"))
	},

	// Parser for t function calls
	FunctionCall: function (r) {
		return Parsimmon.seqMap(
			Parsimmon.regex(/[^a-zA-Z0-9]/), // no preceding letters or numbers
			Parsimmon.string("t"), // starts with t
			Parsimmon.string("("), // then an opening parenthesis
			Parsimmon.index, // start position of the message id
			r.stringLiteral!, // message id
			Parsimmon.index, // end position of the message id
			Parsimmon.regex(/[^)]*/), // ignore the rest of the function call
			Parsimmon.string(")"), // end with a closing parenthesis
			(_, __, ___, start, messageId, end) => {
				return {
					messageId,
					position: {
						start: {
							line: start.line,
							character: start.column,
						},
						end: {
							line: end.line,
							character: end.column,
						},
					},
				}
			}
		)
	},
})

// Parse the expression
export function parse(sourceCode: string) {
	try {
		return parser.entry!.tryParse(sourceCode)
	} catch {
		return []
	}
}
