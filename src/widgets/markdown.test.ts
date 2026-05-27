import assert from 'assert';
import type { ReactRNPlugin, Rem, RichTextInterface } from '@remnote/plugin-sdk';
import {
  fallbackRichTextToMarkdown,
  formatFencedCodeBullet,
  formatMarkdownBullet,
  getCodeBlockLanguage,
  isInternalRemNoteMetadataMarkdown,
  remToMarkdown,
  resolveLocalFileUrl,
  richTextLooksLikeCodeBlock,
} from './markdown';

assert.strictEqual(formatMarkdownBullet('5', 0), '- 5');

assert.strictEqual(
  formatMarkdownBullet('```\nfff\n感觉\n```', 2),
  ['    - ```', '      fff', '      感觉', '      ```'].join('\n')
);

assert.strictEqual(formatMarkdownBullet('line 1\nline 2', 1), '  - line 1\n    line 2');

assert.strictEqual(
  fallbackRichTextToMarkdown([{ i: 'm', text: 'Oracle', url: 'https://signup.cloud.oracle.com/' } as any]),
  '[Oracle](https://signup.cloud.oracle.com/)'
);

assert.strictEqual(
  fallbackRichTextToMarkdown([
    {
      i: 'u',
      title: 'Oracle Cloud Free Tier Signup',
      url: 'https://signup.cloud.oracle.com/',
      siteName: null,
      description: 'Oracle Cloud Free Tier Signup',
      image: 'https://placehold.co/600x400.png',
    } as any,
  ]),
  '[Oracle Cloud Free Tier Signup](https://signup.cloud.oracle.com/)'
);

assert.strictEqual(
  fallbackRichTextToMarkdown([
    { i: 'm', text: 'screenshot ' } as any,
    { i: 'i', url: 'https://example.com/image.png', title: 'img' } as any,
  ]),
  'screenshot ![img](https://example.com/image.png)'
);

const localImageToken = '%LOCAL_FILE%u8dKOxVLYQ3ioS-2HgC0iTxYYvl1tWSIb0SZBQXEiYnvZzjrao7nlL9EE0fx2FMEt-wpulPFC-BDMIo0IOSA1qSMluH4WUg4p03EBX34JtIWOUrA4sZUqwGIhtnQ5cCb.png';
const localImageFileUrl = 'file:///C:/Users/47638/remnote/remnote-608664f8fe7f0f004240f2af/files/u8dKOxVLYQ3ioS-2HgC0iTxYYvl1tWSIb0SZBQXEiYnvZzjrao7nlL9EE0fx2FMEt-wpulPFC-BDMIo0IOSA1qSMluH4WUg4p03EBX34JtIWOUrA4sZUqwGIhtnQ5cCb.png';

assert.strictEqual(resolveLocalFileUrl(localImageToken), localImageFileUrl);

assert.strictEqual(
  fallbackRichTextToMarkdown([{ i: 'i', url: localImageToken, title: 'image.png' } as any]),
  `![image.png](${localImageFileUrl})`
);

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

    const imageRem = makeRem([
      { i: 'm', text: 'with image ' } as any,
      { i: 'i', url: 'https://example.com/image.png' } as any,
    ]);
    const fallbackPlugin = {
      richText: {
        toMarkdown: async () => {
          throw new Error('toMarkdown failed');
        },
      },
    } as unknown as ReactRNPlugin;

    return remToMarkdown(fallbackPlugin, imageRem);
  })
  .then((markdown) => {
    assert.strictEqual(markdown, '- with image ![](https://example.com/image.png)');

    const localImageRem = makeRem(['![image.png](%LOCAL_FILE%u8dKOxVLYQ3ioS-2HgC0iTxYYvl1tWSIb0SZBQXEiYnvZzjrao7nlL9EE0fx2FMEt-wpulPFC-BDMIo0IOSA1qSMluH4WUg4p03EBX34JtIWOUrA4sZUqwGIhtnQ5cCb.png)']);

    return remToMarkdown(fakePlugin, localImageRem);
  })
  .then((markdown) => {
    assert.strictEqual(markdown, `- ![image.png](${localImageFileUrl})`);
    console.log('markdown formatting tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
