# What does this rule do?

Checks for messages to have a camel case message id.

Having the message id's in camel case format is beneficial because it allows for easier integration with other tools and libraries, like `@inlang/paraglide-js`.

## Manual setup

Besides installing the lint rule through `manage.inlang.com` you could also configure it manually.

### Settings

Type:
```ts
type MessageLintRuleLevel = "error" | "warning"
```

Example in the `settings.json`:
```json
{
    // other configuration
    "messageLintRuleLevels": {
		"messageLintRule.inlang.camelCaseId": "error",
	}
}
```

The default level is `warning`
