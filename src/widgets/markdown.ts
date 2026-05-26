import type { ReactRNPlugin, Rem } from '@remnote/plugin-sdk';

export function formatMarkdownBullet(markdown: string, indent: number = 0): string {
  const prefix = `${'  '.repeat(indent)}- `;
  const trimmed = markdown.trim();

  if (!trimmed.includes('\n')) {
    return `${prefix}${trimmed}`;
  }

  const continuationPrefix = '  '.repeat(indent + 1);
  const bulletBody = trimmed
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${continuationPrefix}${line}`))
    .join('\n');

  return `${prefix}${bulletBody}`;
}

export async function remToMarkdown(
  plugin: ReactRNPlugin,
  rem: Rem,
  indent: number = 0
): Promise<string> {
  const lines = [formatMarkdownBullet(await plugin.richText.toMarkdown(rem.text), indent)];
  const children = await rem.getChildrenRem();

  for (const child of children) {
    lines.push(await remToMarkdown(plugin, child, indent + 1));
  }

  return lines.join('\n');
}

export async function remsToMarkdown(plugin: ReactRNPlugin, rems: Rem[]): Promise<string> {
  const markdownBlocks = [];

  for (const rem of rems) {
    markdownBlocks.push(await remToMarkdown(plugin, rem));
  }

  return markdownBlocks.join('\n');
}
