export type ClipboardCopyMethod =
  | 'navigator.clipboard'
  | 'electron.clipboard'
  | 'local.clipboard-bridge'
  | 'execCommand';

export type ClipboardCopyResult = {
  ok: boolean;
  method?: ClipboardCopyMethod;
  error?: unknown;
};

type CopyOptions = {
  allowExecCommand?: boolean;
  allowLocalClipboardBridge?: boolean;
  localClipboardBridgeUrl?: string;
  sourceTextArea?: HTMLTextAreaElement | null;
};

type ClipboardBridge = {
  writeText: (text: string) => void | Promise<void>;
  readText?: () => string | Promise<string>;
};

const DEFAULT_LOCAL_CLIPBOARD_BRIDGE_URL = 'http://127.0.0.1:8031/clipboard';
const LOCAL_CLIPBOARD_BRIDGE_TIMEOUT_MS = 1200;

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
    hasFetch: typeof globalRecord.fetch === 'function',
    localClipboardBridgeUrl: DEFAULT_LOCAL_CLIPBOARD_BRIDGE_URL,
    isSecureContext: Boolean(globalRecord.isSecureContext),
  };
}

async function writeTextWithLocalClipboardBridge(
  text: string,
  bridgeUrl: string = DEFAULT_LOCAL_CLIPBOARD_BRIDGE_URL
): Promise<void> {
  const fetchFn = (globalThis as unknown as { fetch?: typeof fetch }).fetch;

  if (typeof fetchFn !== 'function') {
    throw new Error('fetch is not available for local clipboard bridge');
  }

  const abortController = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timeoutId = abortController
    ? setTimeout(() => abortController.abort(), LOCAL_CLIPBOARD_BRIDGE_TIMEOUT_MS)
    : undefined;

  try {
    const response = await fetchFn(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: abortController?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`local clipboard bridge returned ${response.status}: ${errorText}`);
    }

    const responseJson = await response.json().catch(() => undefined);
    const responseRecord = asRecord(responseJson);

    if (responseRecord && responseRecord.ok === false) {
      throw new Error(String(responseRecord.error ?? 'local clipboard bridge failed'));
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
  {
    allowExecCommand = false,
    allowLocalClipboardBridge = true,
    localClipboardBridgeUrl = DEFAULT_LOCAL_CLIPBOARD_BRIDGE_URL,
    sourceTextArea,
  }: CopyOptions = {}
): Promise<ClipboardCopyResult> {
  let lastDirectCopyFailure: ClipboardCopyResult = { ok: false };

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);

      if (await verifyClipboardText(navigator.clipboard.readText?.bind(navigator.clipboard), text)) {
        return { ok: true, method: 'navigator.clipboard' };
      }

      lastDirectCopyFailure = {
        ok: false,
        method: 'navigator.clipboard',
        error: unverifiedClipboardError('navigator.clipboard'),
      };
    }
  } catch (error) {
    lastDirectCopyFailure = { ok: false, error };
  }

  try {
    const electronClipboard = getElectronClipboard();

    if (electronClipboard) {
      await electronClipboard.writeText(text);

      if (await verifyClipboardText(electronClipboard.readText?.bind(electronClipboard), text)) {
        return { ok: true, method: 'electron.clipboard' };
      }

      lastDirectCopyFailure = {
        ok: false,
        method: 'electron.clipboard',
        error: unverifiedClipboardError('electron.clipboard'),
      };
    }
  } catch (error) {
    lastDirectCopyFailure = { ok: false, error };
  }

  if (allowLocalClipboardBridge) {
    try {
      await writeTextWithLocalClipboardBridge(text, localClipboardBridgeUrl);
      return { ok: true, method: 'local.clipboard-bridge' };
    } catch (error) {
      lastDirectCopyFailure = {
        ok: false,
        method: 'local.clipboard-bridge',
        error,
      };
    }
  }

  if (!allowExecCommand) {
    return lastDirectCopyFailure;
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
