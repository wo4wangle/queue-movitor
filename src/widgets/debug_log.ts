import type { RNPlugin } from '@remnote/plugin-sdk';

export const DEBUG_LOG_STORAGE_KEY = 'copy-bullet-markdown-debug-log';
const MAX_DEBUG_LOG_LINES = 120;

function normalizeForJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item, seen));
  }

  const output: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    output[key] = normalizeForJson(entryValue, seen);
  }

  return output;
}

export function stringifyDebugValue(value: unknown): string {
  try {
    return JSON.stringify(normalizeForJson(value), null, 2);
  } catch (error) {
    return `Could not stringify debug value: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function appendDebugLog(
  plugin: RNPlugin,
  eventName: string,
  details?: unknown
): Promise<void> {
  const line = `${new Date().toISOString()} ${eventName}${
    details === undefined ? '' : ` ${stringifyDebugValue(details)}`
  }`;

  console.debug('[cm]', line);

  try {
    const existingLines = await plugin.storage.getSession<string[]>(DEBUG_LOG_STORAGE_KEY);
    const nextLines = [...(Array.isArray(existingLines) ? existingLines : []), line].slice(
      -MAX_DEBUG_LOG_LINES
    );
    await plugin.storage.setSession(DEBUG_LOG_STORAGE_KEY, nextLines);
  } catch (error) {
    console.warn('[cm] failed to persist debug log', error);
  }
}

export async function getDebugLogText(plugin: RNPlugin): Promise<string> {
  try {
    const lines = await plugin.storage.getSession<string[]>(DEBUG_LOG_STORAGE_KEY);
    return Array.isArray(lines) && lines.length > 0 ? lines.join('\n') : 'No debug logs recorded yet.';
  } catch (error) {
    return `Could not read debug logs: ${error instanceof Error ? error.message : String(error)}`;
  }
}
