## 2026-05-27 11:10 CST - cm debug runtime evidence
- Context: User reported `cm` still failed for bullets containing images or links after RemNote restart.
- Evidence: User-provided `cm debug` showed `isNative: false`, `inSandbox: true`, Clipboard API present, no Electron bridge, target Rem IDs were found, and logs stopped after `copy:targets` with no `copy:markdown`.
- Decision: Treat the failure as markdown generation hanging/throwing before clipboard handling, not a clipboard write failure.
- Fix: Added timeout/fallback markdown conversion for rich text links/images/audio/annotations and an outer copy action catch that logs `copy:unhandled-error`.
- Validation: `npx ts-node src/widgets/markdown.test.ts`, `npm test`, `npm run check-types`, and `npm run build` passed; dev server bundle contains markdown fallback and timeout markers.
