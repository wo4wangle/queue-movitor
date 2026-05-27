import type { ReactRNPlugin, Rem, RichTextInterface } from '@remnote/plugin-sdk';

const REMNOTE_INTERNAL_METADATA_NAMES = new Set(['BoundHeight', 'Language']);
const MARKDOWN_API_TIMEOUT_MS = 3000;

type MarkdownDebugLogger = (eventName: string, details?: unknown) => void | Promise<void>;

export type MarkdownOptions = {
  apiTimeoutMs?: number;
  onDebug?: MarkdownDebugLogger;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function stringifyInlineValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getRichTextElementUrl(record: Record<string, unknown>): string | undefined {
  for (const key of ['url', 'href', 'src']) {
    const value = record[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
}

function getTextElementLinkUrl(record: Record<string, unknown>): string | undefined {
  for (const key of ['url', 'href', 'link']) {
    const value = record[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
}

function linkText(text: string, url: string): string {
  return `[${text.replace(/\]/g, '\\]')}](${url})`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function debug(options: MarkdownOptions | undefined, eventName: string, details?: unknown) {
  await options?.onDebug?.(eventName, details);
}

export function fallbackRichTextToMarkdown(richText: RichTextInterface): string {
  return richText
    .map((element) => {
      if (typeof element === 'string') {
        return element;
      }

      const record = asRecord(element);

      if (!record) {
        return '';
      }

      if (record.i === 'm') {
        const text = stringifyInlineValue(record.text);
        const url = getTextElementLinkUrl(record);
        return url ? linkText(text || url, url) : text;
      }

      if (record.i === 'i') {
        const url = getRichTextElementUrl(record);
        const title = stringifyInlineValue(record.title);
        return url ? `![${title.replace(/\]/g, '\\]')}](${url})` : title;
      }

      if (record.i === 'u') {
        const url = getRichTextElementUrl(record);
        const title =
          stringifyInlineValue(record.title) ||
          stringifyInlineValue(record.description) ||
          stringifyInlineValue(record.siteName) ||
          stringifyInlineValue(record.text) ||
          url ||
          '';

        return url ? linkText(title, url) : title;
      }

      if (record.i === 'a') {
        const url = getRichTextElementUrl(record);
        return url ? `[audio](${url})` : '[audio]';
      }

      if (record.i === 'x') {
        return stringifyInlineValue(record.text);
      }

      if (record.i === 'n') {
        const text = stringifyInlineValue(record.text);
        const url = getRichTextElementUrl(record);
        return url ? linkText(text || url, url) : text;
      }

      if (record.i === 'q' && Array.isArray(record.textOfDeletedRem)) {
        return fallbackRichTextToMarkdown(record.textOfDeletedRem as RichTextInterface);
      }

      if (typeof record.text === 'string') {
        return record.text;
      }

      return '';
    })
    .join('')
    .trim();
}

async function safeToMarkdown(
  plugin: ReactRNPlugin,
  richText: RichTextInterface,
  options?: MarkdownOptions,
  label: string = 'richText.toMarkdown'
): Promise<string> {
  try {
    return await withTimeout(
      plugin.richText.toMarkdown(richText),
      options?.apiTimeoutMs ?? MARKDOWN_API_TIMEOUT_MS,
      label
    );
  } catch (error) {
    const fallbackMarkdown = fallbackRichTextToMarkdown(richText);
    await debug(options, 'markdown:toMarkdown-fallback', {
      label,
      error,
      fallbackLength: fallbackMarkdown.length,
      richText,
    });
    return fallbackMarkdown;
  }
}

async function safeGetChildrenRem(
  rem: Rem,
  options?: MarkdownOptions
): Promise<Rem[]> {
  try {
    return await withTimeout(
      rem.getChildrenRem(),
      options?.apiTimeoutMs ?? MARKDOWN_API_TIMEOUT_MS,
      'rem.getChildrenRem'
    );
  } catch (error) {
    await debug(options, 'markdown:getChildrenRem-fallback', {
      remId: rem._id,
      error,
    });
    return [];
  }
}

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

async function childrenContainCodeBlockMetadata(
  plugin: ReactRNPlugin,
  children: Rem[],
  options?: MarkdownOptions
): Promise<boolean> {
  for (const child of children) {
    const childMarkdown = await safeToMarkdown(plugin, child.text, options, 'metadata-child.toMarkdown');

    if (isInternalRemNoteMetadataMarkdown(childMarkdown)) {
      return true;
    }
  }

  return false;
}

export async function remToMarkdown(
  plugin: ReactRNPlugin,
  rem: Rem,
  indent: number = 0,
  options?: MarkdownOptions
): Promise<string> {
  await debug(options, 'markdown:rem-start', {
    remId: rem._id,
    indent,
  });
  const children = await safeGetChildrenRem(rem, options);
  const markdown = await safeToMarkdown(plugin, rem.text, options, 'rem.toMarkdown');

  if (richTextLooksLikeCodeBlock(rem.text) || (await childrenContainCodeBlockMetadata(plugin, children, options))) {
    return formatFencedCodeBullet(markdown, indent, getCodeBlockLanguage(rem.text));
  }

  const lines = [formatMarkdownBullet(markdown, indent)];

  for (const child of children) {
    const childMarkdown = await safeToMarkdown(plugin, child.text, options, 'child.toMarkdown');

    if (isInternalRemNoteMetadataMarkdown(childMarkdown)) {
      continue;
    }

    lines.push(await remToMarkdown(plugin, child, indent + 1, options));
  }

  return lines.join('\n');
}

export async function remsToMarkdown(
  plugin: ReactRNPlugin,
  rems: Rem[],
  options?: MarkdownOptions
): Promise<string> {
  const markdownBlocks = [];

  for (const rem of rems) {
    markdownBlocks.push(await remToMarkdown(plugin, rem, 0, options));
  }

  return markdownBlocks.join('\n');
}
