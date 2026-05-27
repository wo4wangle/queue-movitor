import assert from 'assert';
import { describeClipboardEnvironment, readTextFromClipboard, writeTextToClipboard } from './clipboard';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

function setGlobalProperty(name: 'navigator' | 'window' | 'document' | 'fetch', value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  });
}

function restoreGlobalProperty(name: 'navigator' | 'window' | 'document' | 'fetch', descriptor?: PropertyDescriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete (globalThis as Record<string, unknown>)[name];
  }
}

async function run() {
  let nativeCopiedText = '';

  setGlobalProperty('navigator', {});
  setGlobalProperty('window', {
    require: (moduleName: string) =>
      moduleName === 'electron'
        ? {
            clipboard: {
              writeText: (text: string) => {
                nativeCopiedText = text;
              },
              readText: () => nativeCopiedText,
            },
          }
        : undefined,
  });

  const nativeResult = await writeTextToClipboard('native text');
  assert.strictEqual(nativeResult.ok, true);
  assert.strictEqual(nativeResult.method, 'electron.clipboard');
  assert.strictEqual(nativeCopiedText, 'native text');
  assert.strictEqual(describeClipboardEnvironment().hasElectronClipboardWriteText, true);
  assert.strictEqual(describeClipboardEnvironment().hasElectronClipboardReadText, true);

  setGlobalProperty('window', {
    clipboard: {
      writeText: (text: string) => {
        nativeCopiedText = text;
      },
    },
  });

  const unverifiedNativeResult = await writeTextToClipboard('unverified native text', {
    allowLocalClipboardBridge: false,
  });
  assert.strictEqual(unverifiedNativeResult.ok, false);
  assert.strictEqual(unverifiedNativeResult.method, 'electron.clipboard');

  let bridgeCopiedText = '';
  setGlobalProperty('window', {});
  setGlobalProperty('fetch', async (_url: string, init?: { body?: string }) => {
    bridgeCopiedText = JSON.parse(init?.body ?? '{}').text;

    return {
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => 'ok',
    };
  });

  const bridgeResult = await writeTextToClipboard('bridge text');
  assert.strictEqual(bridgeResult.ok, true);
  assert.strictEqual(bridgeResult.method, 'local.clipboard-bridge');
  assert.strictEqual(bridgeCopiedText, 'bridge text');

  setGlobalProperty('fetch', async (url: string, init?: { body?: string; method?: string }) => {
    if (init?.method === 'POST') {
      bridgeCopiedText = JSON.parse(init?.body ?? '{}').text;

      return {
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => 'ok',
      };
    }

    assert.strictEqual(url, 'http://127.0.0.1:8031/clipboard');
    return {
      ok: true,
      json: async () => ({ ok: true, text: bridgeCopiedText }),
      text: async () => bridgeCopiedText,
    };
  });

  const bridgeReadResult = await readTextFromClipboard();
  assert.strictEqual(bridgeReadResult.ok, true);
  assert.strictEqual(bridgeReadResult.method, 'local.clipboard-bridge');
  assert.strictEqual(bridgeReadResult.ok ? bridgeReadResult.text : '', 'bridge text');

  let execCommandCalls = 0;
  const fakeTextArea = {
    value: '',
    setAttribute: () => {},
    style: {},
    focus: () => {},
    select: () => {},
    setSelectionRange: () => {},
  };

  setGlobalProperty('window', {});
  setGlobalProperty('document', {
    createElement: () => fakeTextArea,
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    execCommand: () => {
      execCommandCalls += 1;
      return true;
    },
  });

  const noExecResult = await writeTextToClipboard('plain text', {
    allowLocalClipboardBridge: false,
  });
  assert.strictEqual(noExecResult.ok, false);
  assert.strictEqual(execCommandCalls, 0);

  const execResult = await writeTextToClipboard('manual text', {
    allowExecCommand: true,
    allowLocalClipboardBridge: false,
  });
  assert.strictEqual(execResult.ok, true);
  assert.strictEqual(execResult.method, 'execCommand');
  assert.strictEqual(execCommandCalls, 1);
}

run()
  .then(() => {
    console.log('clipboard tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    restoreGlobalProperty('navigator', originalNavigator);
    restoreGlobalProperty('window', originalWindow);
    restoreGlobalProperty('document', originalDocument);
    restoreGlobalProperty('fetch', originalFetch);
  });
