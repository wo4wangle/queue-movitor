import {
  declareIndexPlugin,
  type CommandArgs,
  type ReactRNPlugin,
  type Rem,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';
import { writeTextToClipboard } from './clipboard';
import { remsToMarkdown } from './markdown';

const COPY_POPUP_WIDGET = 'sample_widget';

type CopyCommandArgs = Partial<CommandArgs> & {
  remId?: string;
};

function uniqueIds(ids: Array<string | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

async function findTargetRems(plugin: ReactRNPlugin, args?: CopyCommandArgs): Promise<Rem[]> {
  const selectedRemIds = args?.selectedRem ?? [];
  const commandRemIds =
    selectedRemIds.length > 0
      ? selectedRemIds
      : uniqueIds([args?.focusedRem, args?.remId, args?.titleRem]);

  if (commandRemIds.length > 0) {
    const rems = await Promise.all(commandRemIds.map((id) => plugin.rem.findOne(id)));
    return rems.filter((rem): rem is Rem => Boolean(rem));
  }

  const focusedRem = await plugin.focus.getFocusedRem();
  return focusedRem ? [focusedRem] : [];
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.toast('Plugin activated');

  await plugin.app.registerWidget(COPY_POPUP_WIDGET, WidgetLocation.Popup, {
    dimensions: { width: 500, height: 300 },
  });

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

      await focusedRem.setParent(parentRemId, children.length - 1);

      await plugin.app.toast('Moved rem to bottom!');
    },
  });

  const copyBulletMarkdownAction = async (args?: CopyCommandArgs) => {
    const targetRems = await findTargetRems(plugin, args);

    if (targetRems.length === 0) {
      await plugin.app.toast('No rem is focused');
      return;
    }

    const md = await remsToMarkdown(plugin, targetRems);
    const markdownStorageKey = `copy-bullet-markdown-${Date.now()}`;

    await plugin.storage.setSession(markdownStorageKey, md);

    const copyResult = await writeTextToClipboard(md, {
      allowExecCommand: plugin.isNative === true,
    });

    if (copyResult.ok) {
      await plugin.app.toast('Copied bullet markdown to clipboard');
      return;
    }

    await plugin.widget.openPopup(COPY_POPUP_WIDGET, {
      markdownContent: md,
      markdownStorageKey,
      markdownLength: md.length,
      copyError: copyResult.error instanceof Error ? copyResult.error.message : String(copyResult.error ?? ''),
    });
  };

  await plugin.app.registerCommand({
    id: 'copy-bullet-markdown-cmd',
    name: 'Copy Bullet Markdown',
    keyboardShortcut: 'alt+shift+c',
    action: copyBulletMarkdownAction,
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

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
