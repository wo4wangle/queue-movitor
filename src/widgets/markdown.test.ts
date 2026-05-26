import assert from 'assert';
import type { ReactRNPlugin, Rem, RichTextInterface } from '@remnote/plugin-sdk';
import {
  formatFencedCodeBullet,
  formatMarkdownBullet,
  getCodeBlockLanguage,
  isInternalRemNoteMetadataMarkdown,
  remToMarkdown,
  richTextLooksLikeCodeBlock,
} from './markdown';

assert.strictEqual(formatMarkdownBullet('5', 0), '- 5');

assert.strictEqual(
  formatMarkdownBullet('```\nfff\n感觉\n```', 2),
  ['    - ```', '      fff', '      感觉', '      ```'].join('\n')
);

assert.strictEqual(formatMarkdownBullet('line 1\nline 2', 1), '  - line 1\n    line 2');

assert.strictEqual(
  formatFencedCodeBullet('haha', 2),
  ['    - ```', '      haha', '      ```'].join('\n')
);

assert.strictEqual(
  formatFencedCodeBullet('const x = 1;', 1, 'typescript'),
  ['  - ```typescript', '    const x = 1;', '    ```'].join('\n')
);

assert.strictEqual(
  richTextLooksLikeCodeBlock([{ i: 'm', text: 'haha', code: true } as any]),
  true
);

assert.strictEqual(getCodeBlockLanguage([{ i: 'm', text: 'haha', code: true, language: 'js' } as any]), 'js');

assert.strictEqual(
  isInternalRemNoteMetadataMarkdown('[BoundHeight](https://www.remnote.com/doc/kuvCt3FCP2AzwFlAd)'),
  true
);

assert.strictEqual(
  isInternalRemNoteMetadataMarkdown('[Language](https://www.remnote.com/doc/7mlRzc0rzYER2GuVg)'),
  true
);

assert.strictEqual(isInternalRemNoteMetadataMarkdown('Language'), false);

function makeRem(text: RichTextInterface, children: Rem[] = []): Rem {
  return {
    text,
    getChildrenRem: async () => children,
  } as unknown as Rem;
}

const fakePlugin = {
  richText: {
    toMarkdown: async (richText: RichTextInterface) => {
      const first = richText[0];

      if (first === 'BOUND_HEIGHT') {
        return '[BoundHeight](https://www.remnote.com/doc/kuvCt3FCP2AzwFlAd)';
      }

      if (first === 'LANGUAGE') {
        return '[Language](https://www.remnote.com/doc/7mlRzc0rzYER2GuVg)';
      }

      if (typeof first === 'string') {
        return first;
      }

      return 'text' in first ? first.text : '';
    },
  },
} as unknown as ReactRNPlugin;

const codeMetadataChildren = [
  makeRem(['BOUND_HEIGHT']),
  makeRem(['LANGUAGE']),
];
const root = makeRem(
  ['remnote plugin dev'],
  [makeRem(['test'], [makeRem(['haha'], codeMetadataChildren)])]
);

remToMarkdown(fakePlugin, root)
  .then((markdown) => {
    assert.strictEqual(
      markdown,
      ['- remnote plugin dev', '  - test', '    - ```', '      haha', '      ```'].join('\n')
    );
    console.log('markdown formatting tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
