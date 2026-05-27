function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function leadingIndentWidth(line: string): number {
  let width = 0;

  for (const char of line) {
    if (char === ' ') {
      width += 1;
    } else if (char === '\t') {
      width += 2;
    } else {
      break;
    }
  }

  return width;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right > 0) {
    const next = left % right;
    left = right;
    right = next;
  }

  return left;
}

function inferIndentUnit(indentWidths: number[]): number {
  const positiveWidths = indentWidths.filter((width) => width > 0);

  if (positiveWidths.length === 0) {
    return 2;
  }

  const gcd = positiveWidths.reduce((acc, width) => greatestCommonDivisor(acc, width));
  return gcd > 0 ? gcd : 2;
}

function stripPlainBulletPrefix(text: string): string {
  return text.replace(/^[-*+•]\s+/, '');
}

function lineLooksLikeMarkdownBullet(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line);
}

export function normalizeCopiedSelectionTextToMarkdown(text: string): string {
  const lines = normalizeLineEndings(text)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return '';
  }

  if (lines.every(lineLooksLikeMarkdownBullet)) {
    return lines.join('\n');
  }

  const indentWidths = lines.map(leadingIndentWidth);
  const minIndentWidth = Math.min(...indentWidths);
  const indentUnit = inferIndentUnit(indentWidths.map((width) => Math.max(0, width - minIndentWidth)));

  return lines
    .map((line, index) => {
      const indentWidth = Math.max(0, indentWidths[index] - minIndentWidth);
      const level = Math.max(0, Math.round(indentWidth / indentUnit));
      return `${'  '.repeat(level)}- ${stripPlainBulletPrefix(line.trim())}`;
    })
    .join('\n');
}
