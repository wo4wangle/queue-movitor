import {
  AppEvents,
  declareIndexPlugin,
  type ReactRNPlugin,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';
import { describeClipboardEnvironment, readTextFromClipboard, writeTextToClipboard } from './clipboard';
import { normalizeCopiedSelectionTextToMarkdown } from './copied_selection';
import { appendDebugLog, getDebugLogText, stringifyDebugValue } from './debug_log';
import { remsToMarkdown } from './markdown';
import {
  extractRemIdsFromSelectionEvent,
  findTargetRems,
  getEditorSelectedRemIds,
  type CopyCommandArgs,
} from './target_rems';

const COPY_POPUP_WIDGET = 'sample_widget';
const SELECTION_CACHE_LISTENER_KEY = 'copy-bullet-markdown-selection-cache';
const FOCUSED_REM_CACHE_LISTENER_KEY = 'copy-bullet-markdown-focused-rem-cache';
const SELECTION_CACHE_MAX_AGE_MS = 120000;
const SELECTION_CACHE_POLL_INTERVAL_MS = 500;

let lastSelectedRemIds: string[] = [];
let lastSelectedRemIdsAt = 0;
let selectionCachePollingIntervalId: ReturnType<typeof setInterval> | undefined;

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

async function refreshSelectionCache(plugin: ReactRNPlugin, event?: unknown, source: string = 'api') {
  const eventSelectedRemIds = extractRemIdsFromSelectionEvent(event);
  const selectedRemIds =
    eventSelectedRemIds.length > 0 ? eventSelectedRemIds : await getEditorSelectedRemIds(plugin);

  if (selectedRemIds.length > 0) {
    const changed = !sameIds(lastSelectedRemIds, selectedRemIds);
    lastSelectedRemIds = selectedRemIds;
    lastSelectedRemIdsAt = Date.now();

    if (changed) {
      await appendDebugLog(plugin, 'selection-cache:update', {
        source: eventSelectedRemIds.length > 0 ? `${source}:event` : source,
        remIds: selectedRemIds,
      });
    }
  } else if (event !== undefined) {
    await appendDebugLog(plugin, 'selection-cache:empty-event', {
      source,
      event,
    });
  }
}

function getRecentSelectedRemIds(): string[] {
  if (Date.now() - lastSelectedRemIdsAt > SELECTION_CACHE_MAX_AGE_MS) {
    return [];
  }

  return lastSelectedRemIds;
}

async function getSelectionDiagnostics(plugin: ReactRNPlugin) {
  const diagnostics: Record<string, unknown> = {
    plugin: {
      isNative: plugin.isNative,
      inSandbox: plugin.inSandbox,
      rootURL: plugin.rootURL,
    },
    clipboard: describeClipboardEnvironment(),
    recentSelectedRemIds: getRecentSelectedRemIds(),
    recentSelectedRemAgeMs: lastSelectedRemIdsAt === 0 ? undefined : Date.now() - lastSelectedRemIdsAt,
  };

  try {
    diagnostics.editorSelectedRemIds = await getEditorSelectedRemIds(plugin);
  } catch (error) {
    diagnostics.editorSelectedRemError = error;
  }

  try {
    const selection = await plugin.editor.getSelection();
    diagnostics.editorSelection = selection;
    diagnostics.extractedSelectionRemIds = extractRemIdsFromSelectionEvent(selection);
  } catch (error) {
    diagnostics.editorSelectionError = error;
  }

  try {
    const focusedRem = await plugin.focus.getFocusedRem();
    diagnostics.focusedRemId = focusedRem?._id;
  } catch (error) {
    diagnostics.focusedRemError = error;
  }

  return diagnostics;
}

async function openDebugPopup(plugin: ReactRNPlugin) {
  const diagnostics = await getSelectionDiagnostics(plugin);
  const debugLog = await getDebugLogText(plugin);
  const markdown = [
    '# cm debug',
    '',
    '## Diagnostics',
    '```json',
    stringifyDebugValue(diagnostics),
    '```',
    '',
    '## Recent Logs',
    '```text',
    debugLog,
    '```',
  ].join('\n');
  const markdownStorageKey = `copy-bullet-markdown-debug-${Date.now()}`;

  await plugin.storage.setSession(markdownStorageKey, markdown);
  await plugin.widget.openPopup(COPY_POPUP_WIDGET, {
    markdownContent: markdown,
    markdownStorageKey,
    markdownLength: markdown.length,
  });
}

async function openCopyPopup(
  plugin: ReactRNPlugin,
  markdown: string,
  copyError?: string
) {
  const markdownStorageKey = `copy-bullet-markdown-${Date.now()}`;
  await plugin.storage.setSession(markdownStorageKey, markdown);

  await plugin.widget.openPopup(COPY_POPUP_WIDGET, {
    markdownContent: markdown,
    markdownStorageKey,
    markdownLength: markdown.length,
    copyError,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryCopyCurrentEditorSelectionViaRemNote(plugin: ReactRNPlugin): Promise<boolean> {
  try {
    await appendDebugLog(plugin, 'copy:editor-copy-fallback:start');
    const beforeReadResult = await readTextFromClipboard();
    const selectionType = await plugin.editor.copy();
    await sleep(120);

    await appendDebugLog(plugin, 'copy:editor-copy-fallback:selection-type', {
      selectionType: selectionType ?? null,
      selectionTypeString: String(selectionType),
      selectionTypeTypeof: typeof selectionType,
    });

    const readResult = await readTextFromClipboard();

    await appendDebugLog(
      plugin,
      'copy:editor-copy-fallback:read-result',
      readResult.ok
        ? {
            ok: true,
            method: readResult.method,
            length: readResult.text.length,
            lines: readResult.text.split('\n').length,
            changedFromBefore:
              !beforeReadResult.ok || beforeReadResult.text !== readResult.text,
          }
        : readResult
    );

    if (!readResult.ok || readResult.text.trim().length === 0) {
      return false;
    }

    if (String(selectionType) !== 'Rem' && beforeReadResult.ok && beforeReadResult.text === readResult.text) {
      return false;
    }

    const markdown = normalizeCopiedSelectionTextToMarkdown(readResult.text);

    await appendDebugLog(plugin, 'copy:editor-copy-fallback:markdown', {
      length: markdown.length,
      lines: markdown.split('\n').length,
    });

    if (markdown.trim().length === 0) {
      return false;
    }

    const copyResult = await writeTextToClipboard(markdown);

    await appendDebugLog(plugin, 'copy:editor-copy-fallback:clipboard-result', copyResult);

    if (copyResult.ok) {
      await plugin.app.toast('Copied selected bullets to clipboard');
      return true;
    }

    await openCopyPopup(
      plugin,
      markdown,
      copyResult.error instanceof Error ? copyResult.error.message : String(copyResult.error ?? '')
    );
    return true;
  } catch (error) {
    await appendDebugLog(plugin, 'copy:editor-copy-fallback:error', error);
    return false;
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.toast('Plugin activated');

  await plugin.app.registerWidget(COPY_POPUP_WIDGET, WidgetLocation.Popup, {
    dimensions: { width: 500, height: 300 },
  });
  await appendDebugLog(plugin, 'activate', {
    isNative: plugin.isNative,
    inSandbox: plugin.inSandbox,
    rootURL: plugin.rootURL,
    clipboard: describeClipboardEnvironment(),
  });

  const updateSelectionCache = (event: unknown) => {
    void refreshSelectionCache(plugin, event, 'event');
  };

  plugin.event.addListener(
    AppEvents.EditorSelectionChanged,
    SELECTION_CACHE_LISTENER_KEY,
    updateSelectionCache
  );
  plugin.event.addListener(
    AppEvents.FocusedRemChange,
    FOCUSED_REM_CACHE_LISTENER_KEY,
    updateSelectionCache
  );
  selectionCachePollingIntervalId = setInterval(() => {
    void refreshSelectionCache(plugin, undefined, 'poll');
  }, SELECTION_CACHE_POLL_INTERVAL_MS);
  void refreshSelectionCache(plugin, undefined, 'activate');

  // Register command to move rem to top with keyboard shortcut
  await plugin.app.registerCommand({
    id: 'move-rem-to-top',
    name: 'Move Rem to Top',
    // Option + Shift + Up Arrow
    keyboardShortcut: 'alt+shift+up',
    action: async () => {
      // Get the currently focused rem
      const focusedRem = await plugin.focus.getFocusedRem();
      
      if (!focusedRem) {
        await plugin.app.toast('No rem is focused');
        return;
      }

      // Get the parent rem
      const parentRemId = focusedRem.parent;
      
      if (!parentRemId) {
        await plugin.app.toast('This rem has no parent');
        return;
      }

      const parentRem = await plugin.rem.findOne(parentRemId);
      
      if (!parentRem) {
        await plugin.app.toast('Parent rem not found');
        return;
      }

      // Get all children of the parent
      const children = parentRem.children || [];
      
      // Find current position
      const currentIndex = children.indexOf(focusedRem._id);
      
      if (currentIndex === -1) {
        await plugin.app.toast('Could not find rem in parent\'s children');
        return;
      }

      if (currentIndex === 0) {
        await plugin.app.toast('Rem is already at the top');
        return;
      }

      // Move rem to the top by changing its parent
      // First, get the first child (which will be after our rem)
      await focusedRem.setParent(parentRemId, 0);
      
      await plugin.app.toast('Moved rem to top!');
    },
  });

  // Register command to move rem to bottom with keyboard shortcut
  await plugin.app.registerCommand({
    id: 'move-rem-to-bottom',
    name: 'Move Rem to Bottom',
    keyboardShortcut: 'alt+shift+down',
    action: async () => {
      const focusedRem = await plugin.focus.getFocusedRem();

      if (!focusedRem) {
        await plugin.app.toast('No rem is focused');
        return;
      }

      const parentRemId = focusedRem.parent;

      if (!parentRemId) {
        await plugin.app.toast('This rem has no parent');
        return;
      }

      const parentRem = await plugin.rem.findOne(parentRemId);

      if (!parentRem) {
        await plugin.app.toast('Parent rem not found');
        return;
      }

      const children = parentRem.children || [];
      const currentIndex = children.indexOf(focusedRem._id);

      if (currentIndex === -1) {
        await plugin.app.toast('Could not find rem in parent\'s children');
        return;
      }

      if (currentIndex === children.length - 1) {
        await plugin.app.toast('Rem is already at the bottom');
        return;
      }

      await focusedRem.setParent(parentRemId, children.length);

      await plugin.app.toast('Moved rem to bottom!');
    },
  });

  const copyBulletMarkdownAction = async (args?: CopyCommandArgs) => {
    try {
      const recentSelectedRemIds = getRecentSelectedRemIds();

      await appendDebugLog(plugin, 'copy:start', {
        args,
        recentSelectedRemIds,
        recentSelectedRemAgeMs: lastSelectedRemIdsAt === 0 ? undefined : Date.now() - lastSelectedRemIdsAt,
        clipboard: describeClipboardEnvironment(),
      });

      const targetRems = await findTargetRems(plugin, args, recentSelectedRemIds);

      await appendDebugLog(plugin, 'copy:targets', {
        targetRemIds: targetRems.map((rem) => rem._id),
      });

      if (targetRems.length === 0) {
        await appendDebugLog(plugin, 'copy:no-target', await getSelectionDiagnostics(plugin));

        if (await tryCopyCurrentEditorSelectionViaRemNote(plugin)) {
          return;
        }

        await plugin.app.toast('No rem is selected or focused');
        return;
      }

      const md = await remsToMarkdown(plugin, targetRems, {
        onDebug: (eventName, details) => appendDebugLog(plugin, eventName, details),
      });

      await appendDebugLog(plugin, 'copy:markdown', {
        length: md.length,
        lines: md.split('\n').length,
      });

      const copyResult = await writeTextToClipboard(md);

      await appendDebugLog(plugin, 'copy:clipboard-result', copyResult);

      if (copyResult.ok) {
        await plugin.app.toast('Copied bullet markdown to clipboard');
        return;
      }

      await appendDebugLog(plugin, 'copy:fallback-popup', {
        copyError: copyResult.error instanceof Error ? copyResult.error.message : String(copyResult.error ?? ''),
        copyMethod: copyResult.method,
      });
      await openCopyPopup(
        plugin,
        md,
        copyResult.error instanceof Error ? copyResult.error.message : String(copyResult.error ?? '')
      );
    } catch (error) {
      await appendDebugLog(plugin, 'copy:unhandled-error', error);
      await plugin.app.toast('Copy Markdown failed. Run cm debug for details.');
    }
  };

  await plugin.app.registerCommand({
    id: 'copy-bullet-markdown-cmd',
    name: 'cm',
    description: 'Copy selected or focused bullets as Markdown',
    keywords: 'copy markdown bullet',
    quickCode: 'cm',
    keyboardShortcut: 'alt+shift+c',
    action: copyBulletMarkdownAction,
  });

  await plugin.app.registerCommand({
    id: 'copy-bullet-markdown-debug-cmd',
    name: 'cm debug',
    description: 'Show Copy Markdown debug information',
    keywords: 'copy markdown debug clipboard selection',
    quickCode: 'cm debug',
    action: async () => {
      await appendDebugLog(plugin, 'debug:open-command');
      await openDebugPopup(plugin);
    },
  });

  try {
    await plugin.app.registerRemMenuItem({
      id: 'copy-bullet-markdown',
      name: 'Copy Bullet Markdown',
      action: copyBulletMarkdownAction,
    });
  } catch (e) {
    console.warn('registerRemMenuItem failed:', e);
  }
}

async function onDeactivate(plugin: ReactRNPlugin) {
  plugin.event.removeListener(AppEvents.EditorSelectionChanged, SELECTION_CACHE_LISTENER_KEY);
  plugin.event.removeListener(AppEvents.FocusedRemChange, FOCUSED_REM_CACHE_LISTENER_KEY);

  if (selectionCachePollingIntervalId !== undefined) {
    clearInterval(selectionCachePollingIntervalId);
    selectionCachePollingIntervalId = undefined;
  }

  lastSelectedRemIds = [];
  lastSelectedRemIdsAt = 0;
}

declareIndexPlugin(onActivate, onDeactivate);
