export type ClipboardCopyMethod = 'navigator.clipboard' | 'execCommand';

export type ClipboardCopyResult = {
  ok: boolean;
  method?: ClipboardCopyMethod;
  error?: unknown;
};

type CopyOptions = {
  allowExecCommand?: boolean;
  sourceTextArea?: HTMLTextAreaElement | null;
};

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
      return { ok: true, method: 'navigator.clipboard' };
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
