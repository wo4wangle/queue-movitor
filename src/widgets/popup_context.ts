function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getPopupContextString(context: unknown, key: string): string | undefined {
  const queue = [context];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!isRecord(current) || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (typeof current[key] === 'string') {
      return current[key] as string;
    }

    for (const nestedKey of ['contextData', 'openContext']) {
      if (nestedKey in current) {
        queue.push(current[nestedKey]);
      }
    }
  }

  return undefined;
}
