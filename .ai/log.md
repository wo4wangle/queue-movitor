## 2026-05-27 11:10 CST - cm debug runtime evidence
- Context: User reported `cm` still failed for bullets containing images or links after RemNote restart.
- Evidence: User-provided `cm debug` showed `isNative: false`, `inSandbox: true`, Clipboard API present, no Electron bridge, target Rem IDs were found, and logs stopped after `copy:targets` with no `copy:markdown`.
- Decision: Treat the failure as markdown generation hanging/throwing before clipboard handling, not a clipboard write failure.
- Fix: Added timeout/fallback markdown conversion for rich text links/images/audio/annotations and an outer copy action catch that logs `copy:unhandled-error`.
- Validation: `npx ts-node src/widgets/markdown.test.ts`, `npm test`, `npm run check-types`, and `npm run build` passed; dev server bundle contains markdown fallback and timeout markers.

## 2026-05-27 12:04 CST - Link preview fallback
- Context: User-provided `cm debug` showed a link-preview child copied as an empty nested bullet.
- Evidence: `markdown:toMarkdown-fallback` logged `Invalid input` for rich text `[{ i: "u", title: "Oracle Cloud Free Tier Signup", url: "https://signup.cloud.oracle.com/", description, image }]` and `fallbackLength: 0`.
- Fix: `fallbackRichTextToMarkdown` now handles `i: "u"` link previews as Markdown links using title, description, siteName, text, then url as label fallbacks.
- Validation: `npx ts-node src/widgets/markdown.test.ts`, `npm test`, `npm run check-types`, and `npm run build` passed; build reported only existing bundle-size/performance warnings.

## 2026-05-27 12:58 CST - Local image URL expansion
- Context: User reported image bullets exported as `![image.png](%LOCAL_FILE%...)`, which other Markdown tools cannot resolve.
- Evidence: RemNote desktop logs showed the same token resolving to `file:///C:/Users/47638/remnote/remnote-608664f8fe7f0f004240f2af/files/u8dKOxVLYQ3ioS-2HgC0iTxYYvl1tWSIb0SZBQXEiYnvZzjrao7nlL9EE0fx2FMEt-wpulPFC-BDMIo0IOSA1qSMluH4WUg4p03EBX34JtIWOUrA4sZUqwGIhtnQ5cCb.png`; `Test-Path` confirmed the file exists.
- Fix: Added local-file URL resolution for `%LOCAL_FILE%...`, `local://...`, and raw `C:/...` paths, and post-process SDK Markdown output as well as fallback rich-text output.
- Validation: `npx ts-node src/widgets/markdown.test.ts`, `npm test`, `npm run check-types`, and `npm run build` passed; `http://localhost:8030/index-sandbox.js` contains the `%LOCAL_FILE%` resolver and local file base URL.
