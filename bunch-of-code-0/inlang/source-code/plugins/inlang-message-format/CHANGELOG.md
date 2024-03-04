# @inlang/plugin-message-format

## 2.0.0

### Major Changes

- ca96a2461: The message format is now human readable and can be edited manually. The plugin will automatically convert the message format to the internal format.

  1. Add a filePathPattern property to the inlang project

  ```diff
  "plugin.inlang.messageFormat": {
    "filePath": "./src/messages.json",
  +  "pathPattern": "./messages/{languageTag}.json"
  }
  ```

  2. Run `npx paraglide-js compile`

  The compile command will automatically convert existing messages from the `messages.json` file to the new format.

  3. Delete the `messages.json` and `filePath` property in the inlang project

  ```diff
  "plugin.inlang.messageFormat": {
  -  "filePath": "./src/messages.json",
    "pathPattern": "./messages/{languageTag}.json"
  }
  ```

## 1.4.0

### Minor Changes

- c4afa50ca: fix: don't rely on { recursive: true } as the implemention differs per environment

## 1.3.0

### Minor Changes

- 3016bfab8: improve: use new `settingsSchema` property for plugins to provide a shorter feedback loop when the settings are invalid.
- 1d0d7fa05: fix: https://github.com/opral/monorepo/issues/1530

## 1.2.0

### Minor Changes

- 091db828e: fix: don't rely on { recursive: true } as the implemention differs per environment

## 1.1.0

### Minor Changes

- 79c809c8f: improve: the plugin is able to create directories if a the storage file does not exist yet.

  If a user initializes a new project that uses `./.inlang/plugin.inlang.messageFormat/messages.json` as path but the path does not exist yet, the plugin will now create all directories that are non-existend of the path yet and the `messages.json` file itself. This improvement makes getting started with the plugin easier.
