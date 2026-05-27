import assert from 'assert';
import { describeClipboardEnvironment, writeTextToClipboard } from './clipboard';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

function setGlobalProperty(name: 'navigator' | 'window' | 'document', value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  });
}

function restoreGlobalProperty(name: 'navigator' | 'window' | 'document', descriptor?: PropertyDescriptor) {
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

  const unverifiedNativeResult = await writeTextToClipboard('unverified native text');
  assert.strictEqual(unverifiedNativeResult.ok, false);
  assert.strictEqual(unverifiedNativeResult.method, 'electron.clipboard');

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

  const noExecResult = await writeTextToClipboard('plain text');
  assert.strictEqual(noExecResult.ok, false);
  assert.strictEqual(execCommandCalls, 0);

  const execResult = await writeTextToClipboard('manual text', {
    allowExecCommand: true,
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
  });
