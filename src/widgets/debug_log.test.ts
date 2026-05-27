import assert from 'assert';
import type { ReactRNPlugin } from '@remnote/plugin-sdk';
import { DEBUG_LOG_STORAGE_KEY, appendDebugLog, getDebugLogText, stringifyDebugValue } from './debug_log';

function makePlugin() {
  const storage = new Map<string, unknown>();

  return {
    plugin: {
      storage: {
        getSession: async <T,>(key: string) => storage.get(key) as T | undefined,
        setSession: async (key: string, value: unknown) => {
          storage.set(key, value);
        },
      },
    } as unknown as ReactRNPlugin,
    storage,
  };
}

async function run() {
  const { plugin, storage } = makePlugin();

  await appendDebugLog(plugin, 'copy:start', { remIds: ['a', 'b'] });
  await appendDebugLog(plugin, 'copy:result', new Error('blocked'));

  const lines = storage.get(DEBUG_LOG_STORAGE_KEY) as string[];
  assert.strictEqual(lines.length, 2);
  assert(lines[0].includes('copy:start'));
  assert(lines[0].includes('"remIds"'));
  assert(lines[1].includes('blocked'));

  const logText = await getDebugLogText(plugin);
  assert(logText.includes('copy:start'));
  assert(logText.includes('copy:result'));

  const circularValue: Record<string, unknown> = {};
  circularValue.self = circularValue;
  assert(stringifyDebugValue(circularValue).includes('[Circular]'));
}

run()
  .then(() => {
    console.log('debug log tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
