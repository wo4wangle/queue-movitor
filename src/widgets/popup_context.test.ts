import assert from 'assert';
import { getPopupContextString } from './popup_context';

assert.strictEqual(getPopupContextString({ markdownContent: 'direct' }, 'markdownContent'), 'direct');

assert.strictEqual(
  getPopupContextString({ contextData: { markdownContent: 'context-data' } }, 'markdownContent'),
  'context-data'
);

assert.strictEqual(
  getPopupContextString({ openContext: { contextData: { markdownContent: 'legacy' } } }, 'markdownContent'),
  'legacy'
);

assert.strictEqual(getPopupContextString(undefined, 'markdownContent'), undefined);

console.log('popup context tests passed');
