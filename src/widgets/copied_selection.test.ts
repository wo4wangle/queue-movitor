import assert from 'assert';
import { normalizeCopiedSelectionTextToMarkdown } from './copied_selection';

assert.strictEqual(
  normalizeCopiedSelectionTextToMarkdown(['parent', '  child', '    grandchild'].join('\n')),
  ['- parent', '  - child', '    - grandchild'].join('\n')
);

assert.strictEqual(
  normalizeCopiedSelectionTextToMarkdown(['parent', '\tchild', '\t\tgrandchild'].join('\r\n')),
  ['- parent', '  - child', '    - grandchild'].join('\n')
);

assert.strictEqual(
  normalizeCopiedSelectionTextToMarkdown(['• parent', '  • child'].join('\n')),
  ['- parent', '  - child'].join('\n')
);

assert.strictEqual(
  normalizeCopiedSelectionTextToMarkdown(['- parent', '  - child'].join('\n')),
  ['- parent', '  - child'].join('\n')
);

console.log('copied selection tests passed');
