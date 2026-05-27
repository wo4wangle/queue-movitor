export type ClipboardCopyMethod = 'navigator.clipboard' | 'electron.clipboard' | 'execCommand';

export type ClipboardCopyResult = {
  ok: boolean;
  method?: ClipboardCopyMethod;
  error?: unknown;
};

type CopyOptions = {
  allowExecCommand?: boolean;
  sourceTextArea?: HTMLTextAreaElement | null;
};

type ClipboardBridge = {
  writeText: (text: string) => void | Promise<void>;
  readText?: () => string | Promise<string>;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function asClipboardBridge(value: unknown): ClipboardBridge | undefined {
  const record = asRecord(value);
  return typeof record?.writeText === 'function' ? (record as ClipboardBridge) : undefined;
}

function getClipboardFromBridge(value: unknown): ClipboardBridge | undefined {
  const directClipboard = asClipboardBridge(value);

  if (directClipboard) {
    return directClipboard;
  }

  const record = asRecord(value);
  return asClipboardBridge(record?.clipboard);
}

function getElectronClipboard(): ClipboardBridge | undefined {
  const globalRecord = globalThis as unknown as Record<string, unknown>;
  const windowRecord = asRecord(globalRecord.window);
  const directCandidates = [
    asRecord(globalRecord.electron)?.clipboard,
    asRecord(windowRecord?.electron)?.clipboard,
    asRecord(windowRecord?.electronAPI)?.clipboard,
    windowRecord?.clipboard,
    globalRecord.clipboard,
  ];

  for (const candidate of directCandidates) {
    const clipboard = asClipboardBridge(candidate);

    if (clipboard) {
      return clipboard;
    }
  }

  const requireCandidates = [windowRecord?.require, globalRecord.require].filter(
    (candidate): candidate is (moduleName: string) => unknown => typeof candidate === 'function'
  );

  for (const requireCandidate of requireCandidates) {
    for (const moduleName of ['electron', '@electron/remote']) {
      try {
        const electronModule = requireCandidate(moduleName);
        const clipboard =
          getClipboardFromBridge(electronModule) ??
          getClipboardFromBridge(asRecord(electronModule)?.remote);

        if (clipboard) {
          return clipboard;
        }
      } catch {
        // Some hosts expose a require function but block specific modules.
      }
    }
  }
}

async function verifyClipboardText(
  readText: (() => string | Promise<string>) | undefined,
  expectedText: string
): Promise<boolean> {
  if (!readText) {
    return false;
  }

  const actualText = await readText();
  return actualText === expectedText;
}

function unverifiedClipboardError(method: ClipboardCopyMethod): Error {
  return new Error(`${method} write could not be verified`);
}

export function describeClipboardEnvironment(): Record<string, boolean | string> {
  const globalRecord = globalThis as unknown as Record<string, unknown>;
  const windowRecord = asRecord(globalRecord.window);
  const navigatorRecord = asRecord(globalRecord.navigator);
  const clipboardRecord = asRecord(navigatorRecord?.clipboard);
  const electronClipboard = getElectronClipboard();

  return {
    hasNavigatorClipboardWriteText: typeof clipboardRecord?.writeText === 'function',
    hasNavigatorClipboardReadText: typeof clipboardRecord?.readText === 'function',
    hasElectronClipboardWriteText: typeof electronClipboard?.writeText === 'function',
    hasElectronClipboardReadText: typeof electronClipboard?.readText === 'function',
    hasWindowRequire: typeof windowRecord?.require === 'function',
    hasWindowElectron: Boolean(windowRecord?.electron),
    hasWindowElectronAPI: Boolean(windowRecord?.electronAPI),
    isSecureContext: Boolean(globalRecord.isSecureContext),
  };
}

function selectTextArea(textArea: HTMLTextAreaElement) {
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);
}

function copyWithExecCommand(text: string, sourceTextArea?: HTMLTextAreaElement | null): boolean {
  const textArea = sourceTextArea ?? document.createElement('textarea');
  const shouldRemoveTextArea = !sourceTextArea;

  if (shouldRemoveTextArea) {
    textArea.value = text;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
  }

  selectTextArea(textArea);

  try {
    return document.execCommand('copy');
  } finally {
    if (shouldRemoveTextArea) {
      document.body.removeChild(textArea);
    }
  }
}

export async function writeTextToClipboard(
  text: string,
  { allowExecCommand = false, sourceTextArea }: CopyOptions = {}
): Promise<ClipboardCopyResult> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);

      if (await verifyClipboardText(navigator.clipboard.readText?.bind(navigator.clipboard), text)) {
        return { ok: true, method: 'navigator.clipboard' };
      }

      return { ok: false, method: 'navigator.clipboard', error: unverifiedClipboardError('navigator.clipboard') };
    }
  } catch (error) {
    if (!allowExecCommand) {
      return { ok: false, error };
    }
  }

  try {
    const electronClipboard = getElectronClipboard();

    if (electronClipboard) {
      await electronClipboard.writeText(text);

      if (await verifyClipboardText(electronClipboard.readText?.bind(electronClipboard), text)) {
        return { ok: true, method: 'electron.clipboard' };
      }

      return { ok: false, method: 'electron.clipboard', error: unverifiedClipboardError('electron.clipboard') };
    }
  } catch (error) {
    if (!allowExecCommand) {
      return { ok: false, error };
    }
  }

  if (!allowExecCommand) {
    return { ok: false };
  }

  try {
    if (copyWithExecCommand(text, sourceTextArea)) {
      return { ok: true, method: 'execCommand' };
    }
  } catch (error) {
    return { ok: false, error };
  }

  return { ok: false };
}
