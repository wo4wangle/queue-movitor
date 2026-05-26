# Code Requirements

## Scope
- RemNote plugin in this repository, including the index widget commands and popup widgets.
- Covers moving focused Rems to top/bottom and copying a Rem subtree as Markdown bullets.

## Current Goal
- Add a practical "Copy Bullet Markdown" flow that prefers direct clipboard copy and falls back to a convenient manual-copy popup when RemNote/browser security blocks clipboard writes.

## Required Behavior
- `Alt+Shift+Up` moves the focused Rem to the first child position under its parent.
- `Alt+Shift+Down` moves the focused Rem to the last child position under its parent.
- `Alt+Shift+C` and the registered Rem menu item should copy the target Rem and descendants as nested Markdown bullet text.
- Markdown output should preserve child order and indent children with two spaces per nesting level.
- Multiline Rem Markdown, including fenced code blocks, should keep continuation lines indented under the bullet.
- RemNote code block Rems should export as fenced Markdown code blocks and should not export internal metadata children such as `BoundHeight` or `Language`.
- If direct clipboard writing fails, the plugin should open a popup containing the generated Markdown, auto-select it, and give the user an easy manual copy path.
- Popup content must not depend on only one RemNote context shape; it should read direct popup fields, `contextData`, legacy `openContext.contextData`, and a session-storage fallback key.
- In localhost development, avoid relying on a newly added widget entry while an old webpack dev server is still running; webpack entry discovery happens at server startup.

## Constraints And Invariants
- The plugin targets `@remnote/plugin-sdk` v0.0.14.
- The SDK exposes host-side copy for current editor selections and Rem references, but not a typed API for writing arbitrary text to the clipboard.
- Sandboxed RemNote plugin iframes may be blocked from clipboard APIs, so the feature must not depend solely on iframe `navigator.clipboard` or `document.execCommand('copy')`.
- Existing move-to-top and move-to-bottom behavior must remain unchanged.

## Implementation Notes
- `registerRemMenuItem` is present in the SDK but not documented as a public API; keep command-palette registration as the dependable entry point.
- Command callbacks may receive RemNote command context arguments even though the SDK's `CommandFn` type is zero-argument. Prefer context Rem IDs when present, then fall back to the focused Rem.
- The manifest requests native plugin execution so direct clipboard APIs run outside the normal sandboxed iframe when RemNote allows it.
- The copy action stores the generated Markdown in session storage before opening the popup. The popup uses this as a fallback when RemNote does not deliver `openPopup` context data consistently.
- The popup is registered through the pre-existing `sample_widget` widget entry so an already-running dev server can serve the popup bundle without requiring a restart.
- Code block Rems are detected by rich text `code: true` formatting or by internal metadata children; those metadata children are filtered only when they appear as RemNote internal doc links.

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

## Requirement Changes
- 2026-05-26: New requirement to copy a Rem subtree as Markdown bullets, preferably from the Rem 6-dot menu and otherwise from command palette/keyboard shortcut.
- 2026-05-26: Clipboard behavior changed from always opening a popup to trying direct copy first, then opening a popup only when direct copy is blocked.
- 2026-05-26: Popup fallback changed to use session storage when RemNote does not pass context data in the expected shape.
- 2026-05-26: Popup registration changed from the newly added `copy_popup` entry to existing `sample_widget` so the currently running dev server can serve the popup.
- 2026-05-26: Code block export changed from raw text plus internal metadata bullets to fenced Markdown code blocks.

## Validation Notes
- Targeted formatting coverage lives in `src/widgets/markdown.test.ts`.
- 2026-05-26: `npm test` passed.
- 2026-05-26: `npm run check-types` passed.
- 2026-05-26: `npm run build` passed and regenerated `PluginZip.zip`; webpack reported only bundle-size warnings.
- 2026-05-26: Existing dev server on `http://localhost:8030` is serving the updated manifest with `requestNative: true`.
- 2026-05-26: Added popup context shape tests; `npm test`, `npm run check-types`, and `npm run build` passed after the storage fallback fix.
- 2026-05-26: Confirmed `http://localhost:8030/sample_widget-sandbox.js` contains the updated popup code and `index-sandbox.js` points to `sample_widget`.
- 2026-05-26: Added regression coverage for code block metadata children; `npm test`, `npm run check-types`, and `npm run build` passed. Confirmed `http://localhost:8030/index-sandbox.js` contains the updated metadata filter.
