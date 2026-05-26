import assert from 'assert';
import { formatMarkdownBullet } from './markdown';

assert.strictEqual(formatMarkdownBullet('5', 0), '- 5');

assert.strictEqual(
  formatMarkdownBullet('```\nfff\n感觉\n```', 2),
  ['    - ```', '      fff', '      感觉', '      ```'].join('\n')
);

assert.strictEqual(formatMarkdownBullet('line 1\nline 2', 1), '  - line 1\n    line 2');

console.log('markdown formatting tests passed');
