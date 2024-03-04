import { Type, type Static } from "@sinclair/typebox"
import { Translatable } from "@inlang/translatable"
import { ProjectSettings } from "@inlang/project-settings"

/**
 *
 * ---------------- BASE INTERFACES ----------------
 */

const MarketplaceManifestBase = Type.Object({
	$schema: Type.Optional(Type.Literal("https://inlang.com/schema/marketplace-manifest")),
	icon: Type.Optional(Type.String()),
	gallery: Type.Optional(
		Type.Array(
			Type.String({
				description: "The images displayed in the marketplace. The first image is the cover.",
			})
		)
	),
	displayName: Translatable(
		Type.String({ description: "The name which is displayed in the marketplace." })
	),
	description: Translatable(
		Type.String({
			description: "The description which is displayed in the marketplace.",
		})
	),
	publisherName: Type.String(),
	publisherIcon: Type.Optional(Type.String()),
	readme: Translatable(
		Type.TemplateLiteral("${string}.md", { description: "The path to the readme file." })
	),
	recommends: Type.Optional(
		Type.Array(
			Type.Union([
				Type.TemplateLiteral("m/${string}", {
					description:
						"The uniqueIDs, starting with m/[UNIQUEID] of the recommended items with a max amount of 3.",
					maxLength: 3,
				}),
				Type.TemplateLiteral("g/${string}", {
					description:
						"The uniqueIDs, starting with g/[UNIQUEID] of the recommended items with a max amount of 3.",
					maxLength: 3,
				}),
			])
		)
	),
	pricing: Type.Optional(Type.String()),
	keywords: Type.Array(Type.String()),
	license: Type.String({ description: "The license of the item (e.g. Apache-2.0)." }),
	website: Type.Optional(
		Type.String({ description: "An optional link to the website of the item." })
	),
})

const ModuleBase = Type.Intersect([
	MarketplaceManifestBase,
	Type.Object({
		module: ProjectSettings["allOf"][0]["properties"]["modules"]["items"],
	}),
])

/**
 * ---------------- MARKETPLACE ITEMS ----------------
 */

const App = Type.Intersect([
	MarketplaceManifestBase,
	Type.Object({
		pricing: Type.Optional(
			Type.String({
				description: "The pricing model of the app (e.g. free, paid, subscription).",
			})
		),
		id: Type.TemplateLiteral("app.${string}.${string}"),
	}),
])

const Library = Type.Intersect([
	MarketplaceManifestBase,
	Type.Object({
		id: Type.TemplateLiteral("library.${string}.${string}"),
	}),
])

const Plugin = Type.Intersect([
	ModuleBase,
	Type.Object({
		id: Type.TemplateLiteral("plugin.${string}.${string}"),
	}),
])

const MessageLintRule = Type.Intersect([
	ModuleBase,
	Type.Object({
		id: Type.TemplateLiteral("messageLintRule.${string}.${string}"),
	}),
])

const Guide = Type.Intersect([
	MarketplaceManifestBase,
	Type.Object({
		id: Type.TemplateLiteral("guide.${string}.${string}"),
	}),
])

export type MarketplaceManifest = Static<typeof MarketplaceManifest>
export const MarketplaceManifest = Type.Union([App, Library, Plugin, MessageLintRule, Guide], {
	description: "The manifest of a marketplace item.",
})
