import { declareIndexPlugin, type ReactRNPlugin } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

async function onActivate(plugin: ReactRNPlugin) {
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
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
