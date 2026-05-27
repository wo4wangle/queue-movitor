# Code Requirements

## Scope
- RemNote plugin in this repository, including the index widget commands and popup widgets.
- Covers moving focused Rems to top/bottom and copying a Rem subtree as Markdown bullets.

## Current Goal
- Keep a practical `cm` command for copying selected/focused Rem subtrees as Markdown bullets, preferring verified direct clipboard copy through browser/native/local bridge paths and falling back to a convenient manual-copy popup only when all direct paths are blocked or unavailable.

## Required Behavior
- `Alt+Shift+Up` moves the focused Rem to the first child position under its parent.
- `Alt+Shift+Down` moves the focused Rem to the last child position under its parent.
- `Alt+Shift+C`, the command palette command named `cm`, and the registered Rem menu item should copy the target Rem and descendants as nested Markdown bullet text.
- When multiple bullets are selected, the copy action should copy all selected root bullets and their descendants, even if the command palette no longer reports a focused Rem.
- Markdown output should preserve child order and indent children with two spaces per nesting level.
- Multiline Rem Markdown, including fenced code blocks, should keep continuation lines indented under the bullet.
- RemNote code block Rems should export as fenced Markdown code blocks and should not export internal metadata children such as `BoundHeight` or `Language`.
- Rems containing links, link previews, images, audio, annotations, or other rich text elements should not make the copy command silently abort. If the SDK Markdown converter fails or hangs, export a best-effort Markdown fallback such as `[text](url)`, `[title](url)`, or `![title](url)`.
- RemNote local image references should be exported as normal local file URLs instead of `%LOCAL_FILE%...` placeholders when the local file root is known, so copied Markdown can render in other Markdown tools on the same machine.
- The copy action should first try to write the generated Markdown directly to the clipboard without opening UI through reliable direct paths only: browser Clipboard API, RemNote/Electron native clipboard bridge, or the optional localhost clipboard bridge.
- Automatic copy must not treat `document.execCommand('copy')` as verified success because it can return `true` while the RemNote iframe clipboard remains unchanged.
- If verified direct clipboard writing fails, the plugin should open a popup containing the generated Markdown, auto-select it, and give the user an easy manual copy path.
- The plugin should expose a `cm debug` command that opens diagnostics and recent copy logs in a popup so RemNote runtime selection/clipboard behavior can be inspected without DevTools.
- Popup content must not depend on only one RemNote context shape; it should read direct popup fields, `contextData`, legacy `openContext.contextData`, and a session-storage fallback key.
- In localhost development, avoid relying on a newly added widget entry while an old webpack dev server is still running; webpack entry discovery happens at server startup.

## Constraints And Invariants
- The plugin targets `@remnote/plugin-sdk` v0.0.14.
- The SDK exposes host-side copy for current editor selections and Rem references, but not a typed API for writing arbitrary text to the clipboard.
- Sandboxed RemNote plugin iframes may be blocked from clipboard APIs, so the feature must not depend solely on iframe `navigator.clipboard` or `document.execCommand('copy')`.
- The popup's Copy button may still try `execCommand` as a user-gesture helper, but only `navigator.clipboard` or a native clipboard bridge count as verified copy success.
- The local clipboard bridge is a development/local-machine helper bound to `127.0.0.1:8031`; it must accept only trusted localhost dev origins and must preserve Unicode text.
- Existing move-to-top and move-to-bottom behavior must remain unchanged.

## Implementation Notes
- `registerRemMenuItem` is present in the SDK but not documented as a public API; keep command-palette registration as the dependable entry point.
- Command callbacks may receive RemNote command context arguments even though the SDK's `CommandFn` type is zero-argument. Prefer command-selected Rem IDs, live editor Rem selection, explicit context Rem IDs, recent cached Rem selection, then the focused Rem.
- The manifest requests native plugin execution so direct clipboard APIs run outside the normal sandboxed iframe when RemNote allows it.
- Direct copy tries `navigator.clipboard.writeText` first, then likely Electron/native bridges such as `window.require('electron').clipboard.writeText`, `window.electron.clipboard.writeText`, `window.electronAPI.clipboard.writeText`, or `window.clipboard.writeText`, then the optional local bridge at `http://127.0.0.1:8031/clipboard`.
- Direct copy is verified by reading clipboard text back when the API exposes `readText`; unverified writes fall back instead of reporting success.
- The local bridge is implemented by `scripts/clipboard-bridge.js`. `npm run dev` starts both the webpack dev server and the clipboard bridge; `npm run dev:plugin` starts only the webpack dev server; `npm run clipboard-bridge` starts only the bridge; `npm run dev:direct-copy` is kept as an alias for `npm run dev`. On Windows it writes via PowerShell `Set-Clipboard` and explicitly sets `[Console]::InputEncoding` to UTF-8 before reading stdin.
- The copy action stores the generated Markdown in session storage only before opening the popup. The popup uses this as a fallback when RemNote does not deliver `openPopup` context data consistently.
- Copy/debug actions append bounded debug lines to session storage under `copy-bullet-markdown-debug-log` and also write `[cm]` lines to the console.
- The popup is registered through the pre-existing `sample_widget` widget entry so an already-running dev server can serve the popup bundle without requiring a restart.
- Code block Rems are detected by rich text `code: true` formatting or by internal metadata children; those metadata children are filtered only when they appear as RemNote internal doc links.
- Markdown generation wraps `richText.toMarkdown` and `getChildrenRem` with a timeout. On failure, text/link/image/audio/annotation rich text is converted locally so the command can continue to clipboard/popup handling.
- RemNote link previews can arrive as rich text elements shaped like `{ i: "u", title, url, description, image }`; the fallback Markdown converter should render them as `[title || description || siteName || text || url](url)` instead of an empty bullet.
- RemNote Desktop local image placeholders have been observed in RemNote logs as `%LOCAL_FILE%filename.png` resolving to `file:///C:/Users/47638/remnote/remnote-608664f8fe7f0f004240f2af/files/filename.png`; Markdown generation rewrites both SDK-produced Markdown and fallback rich text URLs through this local-file resolver.
- The index widget listens for `EditorSelectionChanged`, extracts Rem IDs directly from the event payload when present, and caches the last non-empty Rem selection for 120 seconds so command-palette focus changes do not make multi-select copy lose its target.

## Bug-Fix Learnings
- Symptom: popup `document.execCommand('copy')` can report no thrown error while the clipboard remains unchanged inside RemNote's plugin iframe.
- Root cause: the plugin runs in a cross-origin/sandboxed frame in normal mode, so browser clipboard access is not reliable.
- Durable lesson: direct copy should first try a real clipboard API in the least-sandboxed available context, and any fallback UI must leave the Markdown visibly selected for manual `Ctrl+C`.
- Symptom: the fallback popup can open with an empty textarea even though Markdown generation succeeded.
- Root cause: RemNote popup context shape can differ by host/runtime, so reading only one path such as `contextData.markdownContent` is brittle.
- Durable lesson: pass a storage key with popup context and make the popup resolve the Markdown through multiple context shapes plus session storage.
- Symptom: popup opens blank in localhost development.
- Root cause: the dev server was started before the new `copy_popup.tsx` entry existed, so `copy_popup-sandbox.js` returned 404.
- Durable lesson: use an existing widget entry or restart the dev server whenever adding a new file under `src/widgets`.
- Symptom: code block export produced `- haha` with child bullets for `[BoundHeight](...)` and `[Language](...)` instead of a fenced code block.
- Root cause: RemNote stores code block details as child Rems/metadata, and `richText.toMarkdown(rem.text)` can return only the raw code text.
- Durable lesson: detect RemNote code block metadata before recursing into children; format the parent text as fenced code and skip internal metadata children.
- Symptom: multi-selected bullets could show `No rem is focused` when running the copy command from the command palette.
- Root cause: the copy action only used command args or `focus.getFocusedRem()`, and command palette focus can leave neither available.
- Durable lesson: query `editor.getSelectedRem()` and keep a short-lived Rem-selection cache from `EditorSelectionChanged` before falling back to focused Rem.
- Symptom: a bullet containing an image could toast as copied without actually changing the clipboard.
- Root cause: automatic copy allowed `document.execCommand('copy')`, and browsers can return success from `execCommand` inside a sandboxed/plugin context even when the system clipboard is not updated.
- Durable lesson: do not use `execCommand` for automatic success; treat it only as an interactive popup helper and rely on Clipboard API/native bridge for verified direct copy.
- Symptom: multi-selected bullets could still show `No rem is selected or focused` after opening the command palette.
- Root cause: the selection cache refreshed by calling `getSelectedRem()` after the selection-change event, which can race with command palette focus changes and miss the original Rem selection.
- Durable lesson: read `remIds` from the `EditorSelectionChanged` event payload itself when available, and use `editor.getSelection()` as a fallback in addition to `getSelectedRem()`.
- Symptom: after restarting RemNote, user still observed the same no-copy/no-selection behavior.
- Root cause: the SDK/runtime behavior inside RemNote desktop could not be inferred from local tests alone.
- Durable lesson: add first-class runtime diagnostics for clipboard capabilities, command args, target Rem IDs, generated Markdown size, fallback reason, and recent selection cache updates.
- Symptom: `cm debug` showed copy logs stopping after `copy:targets` for Rems containing images or links; there was no `copy:markdown` or clipboard result.
- Root cause: markdown generation could hang or throw inside SDK calls before clipboard handling, and the command action had no outer catch.
- Durable lesson: wrap markdown generation with timeouts/fallback conversion and wrap the copy action with an outer error logger/toast so runtime failures are visible.
- Symptom: `cm debug` showed a child link preview exported as a blank nested bullet, for example `- https://signup.cloud.oracle.com/` became `- `.
- Root cause: RemNote represented the link preview as rich text `{ i: "u", title, url, description, image }`, and the local fallback converter did not handle the `u` element type after `richText.toMarkdown` rejected it.
- Durable lesson: keep fallback rich-text conversion keyed to observed RemNote runtime element shapes, not only SDK-documented/plain text link shapes.
- Symptom: image bullets exported as `![image.png](%LOCAL_FILE%...)`, which other Markdown tools could not resolve.
- Root cause: `richText.toMarkdown` can preserve RemNote Desktop's private local-file placeholder instead of expanding it to the local file URL.
- Durable lesson: post-process SDK Markdown output as well as fallback Markdown output for RemNote-local URL placeholders; do not limit URL fixes to fallback-only rich text conversion.
- Symptom: direct copy still opened the popup whenever RemNote sandbox blocked `navigator.clipboard`.
- Root cause: SDK v0.0.14 does not expose a typed arbitrary-text clipboard API, and the plugin iframe has no Electron clipboard bridge in the observed desktop runtime.
- Durable lesson: no-popup arbitrary text copy in local development needs an out-of-frame localhost bridge; keep popup fallback for machines where the bridge is not running.
- Symptom: text copied through the Windows localhost bridge turned Chinese into mojibake, for example `可以过两天再来看下，换英国 ip?` became `鍙互...`.
- Root cause: Windows PowerShell decoded Node's UTF-8 stdin using the console default code page before `Set-Clipboard`.
- Durable lesson: the Windows bridge must set `[Console]::InputEncoding = [System.Text.Encoding]::UTF8` before reading stdin.

## Requirement Changes
- 2026-05-26: New requirement to copy a Rem subtree as Markdown bullets, preferably from the Rem 6-dot menu and otherwise from command palette/keyboard shortcut.
- 2026-05-26: Clipboard behavior changed from always opening a popup to trying direct copy first, then opening a popup only when direct copy is blocked.
- 2026-05-26: Popup fallback changed to use session storage when RemNote does not pass context data in the expected shape.
- 2026-05-26: Popup registration changed from the newly added `copy_popup` entry to existing `sample_widget` so the currently running dev server can serve the popup.
- 2026-05-26: Code block export changed from raw text plus internal metadata bullets to fenced Markdown code blocks.
- 2026-05-26: Command palette name changed from `Copy Bullet Markdown` to `cm` with `quickCode: cm`; direct copy is attempted before any popup, and selected Rems are supported via live/cached Rem selection.
- 2026-05-27: Direct-copy success changed from Clipboard API plus `execCommand` to verified Clipboard API/native bridge only; `execCommand` is no longer used on the automatic path.
- 2026-05-27: Multi-select selection caching changed from API-only refresh to event-payload extraction plus `getSelectedRem()`/`getSelection()` fallback, with cache age extended to 120 seconds.
- 2026-05-27: Added session-backed debug logging and the `cm debug` command for collecting RemNote runtime diagnostics.
- 2026-05-27: Markdown generation changed to tolerate SDK failures/hangs for links/images by timing out and using local rich-text fallback conversion.
- 2026-05-27: Link-preview fallback changed from blank output for `i: "u"` rich text elements to Markdown links using title/description/siteName/text/url fallback order.
- 2026-05-27: Local image export changed from `%LOCAL_FILE%filename` to `file:///C:/Users/47638/remnote/remnote-608664f8fe7f0f004240f2af/files/filename` for the observed local RemNote Desktop data root.
- 2026-05-27: Added optional localhost clipboard bridge fallback so sandboxed RemNote can copy Markdown directly without a popup when `npm run clipboard-bridge` or `npm run dev:direct-copy` is running.
- 2026-05-27: Windows localhost clipboard bridge changed to read stdin as UTF-8 before calling `Set-Clipboard`, fixing Chinese mojibake.
- 2026-05-27: `npm run dev` changed to start both `dev:plugin` and `clipboard-bridge` automatically; `dev:direct-copy` is now an alias for `npm run dev`.
- 2026-05-27: Added Windows logon autostart scripts for the dev server and clipboard bridge, installed as the scheduled task `RemNote Queue Movitor Dev`.

## Validation Notes
- Targeted formatting coverage lives in `src/widgets/markdown.test.ts`.
- 2026-05-26: `npm test` passed.
- 2026-05-26: `npm run check-types` passed.
- 2026-05-26: `npm run build` passed and regenerated `PluginZip.zip`; webpack reported only bundle-size warnings.
- 2026-05-26: Existing dev server on `http://localhost:8030` is serving the updated manifest with `requestNative: true`.
- 2026-05-26: Added popup context shape tests; `npm test`, `npm run check-types`, and `npm run build` passed after the storage fallback fix.
- 2026-05-26: Confirmed `http://localhost:8030/sample_widget-sandbox.js` contains the updated popup code and `index-sandbox.js` points to `sample_widget`.
- 2026-05-26: Added regression coverage for code block metadata children; `npm test`, `npm run check-types`, and `npm run build` passed. Confirmed `http://localhost:8030/index-sandbox.js` contains the updated metadata filter.
- 2026-05-26: Added target Rem selection coverage in `src/widgets/target_rems.test.ts`; targeted `npx ts-node src/widgets/target_rems.test.ts` passed.
- 2026-05-26: `npm test`, `npm run check-types`, and `npm run build` passed after the `cm`, direct-copy-first, and multi-select target changes. Build reported only existing bundle-size/performance warnings.
- 2026-05-26: Confirmed `http://localhost:8030/index-sandbox.js` contains `quickCode: "cm"`, the selection cache, `getSelectedRem`, and the updated no-selection toast.
- 2026-05-27: Added clipboard bridge coverage in `src/widgets/clipboard.test.ts`; targeted `npx ts-node src/widgets/clipboard.test.ts` passed.
- 2026-05-27: Extended `src/widgets/target_rems.test.ts` for selection event payload extraction; targeted `npx ts-node src/widgets/target_rems.test.ts` passed.
- 2026-05-27: `npm test`, `npm run check-types`, and `npm run build` passed after verified direct-copy and multi-select cache changes. Build reported only existing bundle-size/performance warnings.
- 2026-05-27: Confirmed `http://localhost:8030/index-sandbox.js` contains the Electron clipboard bridge, selection extractor, 120-second cache, and no automatic `allowExecCommand: true`.
- 2026-05-27: Added debug log coverage in `src/widgets/debug_log.test.ts`; targeted `npx ts-node src/widgets/debug_log.test.ts` passed.
- 2026-05-27: `npm test`, `npm run check-types`, and `npm run build` passed after adding session debug logging and `cm debug`. Build reported only existing bundle-size/performance warnings.
- 2026-05-27: Confirmed `http://localhost:8030/index-sandbox.js` contains `cm debug`, the debug log storage key, and copy start logging.
- 2026-05-27: Added markdown fallback coverage for links/images and `toMarkdown` failure; targeted `npx ts-node src/widgets/markdown.test.ts` passed.
- 2026-05-27: `npm test`, `npm run check-types`, and `npm run build` passed after markdown timeout/fallback changes. Build reported only existing bundle-size/performance warnings.
- 2026-05-27: Confirmed `http://localhost:8030/index-sandbox.js` contains markdown fallback logging, timeout text, image fallback code, and the outer copy error logger.
- 2026-05-27: Added link-preview fallback coverage for RemNote `i: "u"` rich text; `npx ts-node src/widgets/markdown.test.ts`, `npm test`, `npm run check-types`, and `npm run build` passed. Build reported only existing bundle-size/performance warnings.
- 2026-05-27: Added local image placeholder coverage for `%LOCAL_FILE%...` in SDK-produced Markdown and fallback image rich text; `npx ts-node src/widgets/markdown.test.ts`, `npm test`, `npm run check-types`, and `npm run build` passed. Build reported only existing bundle-size/performance warnings.
- 2026-05-27: Confirmed `http://localhost:8030/index-sandbox.js` contains the `%LOCAL_FILE%` resolver and `file:///C:/Users/47638/remnote/remnote-608664f8fe7f0f004240f2af/files/` base URL.
- 2026-05-27: Added local clipboard bridge coverage in `src/widgets/clipboard.test.ts` and `scripts/clipboard-bridge.test.js`; `node scripts/clipboard-bridge.test.js`, `npm test`, and `npm run check-types` passed.
- 2026-05-27: Runtime smoke test posted `可以过两天再来看下，换英国 ip?` to `http://127.0.0.1:8031/clipboard` and `Get-Clipboard -Raw` returned the exact same Unicode text.
- 2026-05-27: Verified `package.json` dev scripts with a Node assertion that `dev` runs `dev:plugin` plus `clipboard-bridge` without recursively calling itself; `npm test`, `npm run check-types`, and `npm run build` passed. Build reported only existing bundle-size/performance warnings.
- 2026-05-27: Installed scheduled task `RemNote Queue Movitor Dev` with `npm run dev:autostart:install-start`; `Get-ScheduledTaskInfo` reported `LastTaskResult: 0`, and `.ai/dev-autostart.log` showed both ports already running with no duplicate startup.
