---
name: kitly-plugin
description: Create or modify a Kitly plugin — manifest, CommonJS entry, operations (Fal or local), settings. Use when asked to build/scaffold/extend a Kitly plugin or add operations to one.
---

# Creating Kitly Plugins

A Kitly plugin is a git repo loaded by Kitly's main process (full trust, Blender-addon model). This repo (Kitly-ExamplePlugin) is the canonical reference — mirror its shape exactly.

## Package shape
```
<plugin-repo>/
  kitly-plugin.json   # manifest (below)
  index.js            # CommonJS entry exporting { activate }
  README.md
```

## Manifest (kitly-plugin.json)
Required: `id` (kebab-case, globally unique), `name`, `version` (dotted numeric), `description`, `author`, `entry` (relative CJS path), `kitlyApiVersion: 1`.
Optional `contributes.settings`: array of ParamFieldSpec-like fields `{ key, label, type: 'text'|'number'|'select'|'boolean', default?, min?, max?, options? }` — rendered in Kitly Settings without loading plugin code; values reach the plugin via `context.getSettings()`.

## Entry contract (index.js)
`module.exports = { activate }`; `activate(context)` runs once at load in Electron main. Context API:
- `context.registerOperation(definition, { execute? })`
- `context.getSettings()` → resolved settings values
- `context.log(message)` → namespaced logger

## Operation definitions
Standard Kitly OperationDefinition. Rules:
- `id` MUST be prefixed `<plugin-id>.` (e.g. `kitly-example.image.grid`) — unprefixed ids are rejected.
- `category`: `'image'|'video'|'audio'|'3d'|'text'`; `sourceInputs`: `{ key, label, acceptedKinds, falField, multiple?, required }`; `parameters`: ParamFieldSpec list; `outputs`: `{ itemPath, role, kind, defaultExtension, folder }`.
- **Provider ops** (`provider: 'fal' | 'openrouter'`): declarative only — endpoint + specs; Kitly's worker executes them. No `execute`.
- **Local ops** (`provider: 'local'`): MUST pass `{ execute }`. Signature: `async execute({ inputs, sourceFiles: [{ path, kind }], outputDir, settings })` → `[{ fileName, bytes: Buffer, kind }]`. Runs in main: `require('electron')` is available (`nativeImage` for pixel work; offscreen `BrowserWindow` + `capturePage` for anything needing text/canvas rendering — always `win.destroy()` in `finally`). Never write files yourself — return bytes; Kitly registers outputs.

## Checklist before finishing
1. `node -e "require('./index.js')"` parses (don't call activate outside Kitly — electron import will differ).
2. Manifest `id` matches every operation id prefix; `entry` file exists; JSON is valid.
3. Escape user text interpolated into HTML/SVG (`&` → `&amp;`, `<` → `&lt;`).
4. Bump manifest `version` on every change; commit — installs/updates are git-based.
5. To publish: add/update the plugin's entry (`{ id, name, description, gitUrl, version, tags }`) in the `plugins` array of the target plugin repository's `index.json`, then commit that repository too. The repository is whichever index repo the user distributes plugins through — ask for its path/URL if it isn't evident (a sibling directory containing an `index.json` with a `plugins` array is the usual layout). Keep the index entry's `version` in lockstep with the manifest's.
