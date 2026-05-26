import type { ReactRNPlugin, Rem, RichTextInterface } from '@remnote/plugin-sdk';

const REMNOTE_INTERNAL_METADATA_NAMES = new Set(['BoundHeight', 'Language']);

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

export function formatFencedCodeBullet(
  code: string,
  indent: number = 0,
  language?: string
): string {
  const prefix = `${'  '.repeat(indent)}- `;
  const continuationPrefix = '  '.repeat(indent + 1);
  const openingFence = `\`\`\`${language ?? ''}`;
  const body = code.trimEnd();
  const bodyLines = body.length > 0 ? body.split('\n') : [''];

  return [
    `${prefix}${openingFence}`,
    ...bodyLines.map((line) => `${continuationPrefix}${line}`),
    `${continuationPrefix}\`\`\``,
  ].join('\n');
}

function isRichTextTextElement(value: unknown): value is { text: string; code?: boolean; language?: string } {
  return typeof value === 'object' && value !== null && 'text' in value;
}

export function richTextLooksLikeCodeBlock(richText: RichTextInterface): boolean {
  return richText.some((element) => isRichTextTextElement(element) && element.code === true);
}

export function getCodeBlockLanguage(richText: RichTextInterface): string | undefined {
  const codeElement = richText.find(
    (element) => isRichTextTextElement(element) && element.code === true && typeof element.language === 'string'
  );

  return isRichTextTextElement(codeElement) ? codeElement.language : undefined;
}

export function isInternalRemNoteMetadataMarkdown(markdown: string): boolean {
  const match = markdown.trim().match(/^\[([^\]]+)\]\(https:\/\/www\.remnote\.com\/doc\/[^)]+\)$/);
  return Boolean(match && REMNOTE_INTERNAL_METADATA_NAMES.has(match[1]));
}

async function childrenContainCodeBlockMetadata(plugin: ReactRNPlugin, children: Rem[]): Promise<boolean> {
  for (const child of children) {
    const childMarkdown = await plugin.richText.toMarkdown(child.text);

    if (isInternalRemNoteMetadataMarkdown(childMarkdown)) {
      return true;
    }
  }

  return false;
}

export async function remToMarkdown(
  plugin: ReactRNPlugin,
  rem: Rem,
  indent: number = 0
): Promise<string> {
  const children = await rem.getChildrenRem();
  const markdown = await plugin.richText.toMarkdown(rem.text);

  if (richTextLooksLikeCodeBlock(rem.text) || (await childrenContainCodeBlockMetadata(plugin, children))) {
    return formatFencedCodeBullet(markdown, indent, getCodeBlockLanguage(rem.text));
  }

  const lines = [formatMarkdownBullet(markdown, indent)];

  for (const child of children) {
    const childMarkdown = await plugin.richText.toMarkdown(child.text);

    if (isInternalRemNoteMetadataMarkdown(childMarkdown)) {
      continue;
    }

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
