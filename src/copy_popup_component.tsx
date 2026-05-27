import { usePlugin, useTracker } from '@remnote/plugin-sdk';
import { useEffect, useRef, useState } from 'react';
import { writeTextToClipboard } from './widgets/clipboard';
import { appendDebugLog } from './widgets/debug_log';
import { getPopupContextString } from './widgets/popup_context';

export const CopyPopup = () => {
  const plugin = usePlugin();
  const ctx = useTracker(() => plugin.widget.getWidgetContext());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const copyError = getPopupContextString(ctx, 'copyError');

  const selectMarkdown = () => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  };

  useEffect(() => {
    let cancelled = false;

    const loadMarkdown = async () => {
      const contextMarkdown = getPopupContextString(ctx, 'markdownContent');
      const markdownStorageKey = getPopupContextString(ctx, 'markdownStorageKey');

      if (contextMarkdown !== undefined) {
        setMarkdown(contextMarkdown);
        setLoading(false);
        await appendDebugLog(plugin, 'popup:markdown-from-context', {
          length: contextMarkdown.length,
        });
        return;
      }

      if (markdownStorageKey) {
        const storedMarkdown = await plugin.storage.getSession<string>(markdownStorageKey);

        if (!cancelled) {
          setMarkdown(storedMarkdown ?? '');
          setLoading(false);
          await appendDebugLog(plugin, 'popup:markdown-from-storage', {
            markdownStorageKey,
            length: storedMarkdown?.length ?? 0,
          });
        }

        return;
      }

      setLoading(ctx === undefined);
    };

    loadMarkdown();

    return () => {
      cancelled = true;
    };
  }, [ctx, plugin]);

  useEffect(() => {
    if (!loading) {
      selectMarkdown();
    }
  }, [loading, markdown]);

  const handleCopy = async () => {
    const result = await writeTextToClipboard(markdown, {
      allowExecCommand: true,
      sourceTextArea: textareaRef.current,
    });
    await appendDebugLog(plugin, 'popup:copy-result', result);

    if (result.ok && result.method !== 'execCommand') {
      setCopyStatus('Copied.');
      await plugin.app.toast('Copied to clipboard!');
      await plugin.widget.closePopup();
      return;
    }

    selectMarkdown();

    if (result.ok) {
      setCopyStatus('Copy command ran. If paste is empty, press Ctrl+C while the text is selected.');
      await plugin.app.toast('Copy command ran. Press Ctrl+C if paste is empty.');
      return;
    }

    setCopyStatus('Copy failed. Press Ctrl+C while the text is selected.');
    await plugin.app.toast('Copy failed. Press Ctrl+C while the text is selected.');
  };

  return (
    <div style={{ padding: 12, maxWidth: 500, maxHeight: 400, overflow: 'auto', color: '#111827' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>Copy Bullet Markdown</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={selectMarkdown}
            style={{
              padding: '4px 10px',
              backgroundColor: '#f3f4f6',
              color: '#111827',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Select All
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '4px 12px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      </div>
      <div style={{ marginBottom: 8, fontSize: 12, color: '#4b5563' }}>
        {copyStatus ||
          (loading
            ? 'Loading markdown...'
            : !markdown
            ? 'No markdown content was received. Run the command again after focusing a Rem.'
            : copyError
            ? 'Direct clipboard copy was blocked. Press Ctrl+C to copy the selected text.'
            : 'Press Ctrl+C if the Copy button is blocked.')}
      </div>
      <textarea
        ref={textareaRef}
        readOnly
        value={markdown}
        style={{
          width: '100%',
          height: 200,
          fontFamily: 'monospace',
          fontSize: 12,
          padding: 8,
          border: '1px solid #ccc',
          borderRadius: 4,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
        onClick={selectMarkdown}
        onFocus={selectMarkdown}
      />
    </div>
  );
};
