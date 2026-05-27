import type { CommandArgs, ReactRNPlugin, Rem } from '@remnote/plugin-sdk';

export type CopyCommandArgs = Partial<CommandArgs> & {
  remId?: string;
};

function uniqueIds(ids: Array<string | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function remIdsFromObjectArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueIds(
    value.map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      const record = asRecord(item);
      const remId = record?.remId;
      const id = record?._id ?? record?.id;

      return typeof remId === 'string' ? remId : typeof id === 'string' ? id : undefined;
    })
  );
}

export function extractRemIdsFromSelectionEvent(event: unknown, depth: number = 0): string[] {
  if (depth > 4) {
    return [];
  }

  if (Array.isArray(event)) {
    return uniqueIds(
      event.flatMap((item) => extractRemIdsFromSelectionEvent(item, depth + 1))
    );
  }

  const record = asRecord(event);

  if (!record) {
    return [];
  }

  for (const key of [
    'selectedDeepRemHighestLevelIds',
    'selectedRemIds',
    'selectedRem',
    'remIds',
    'selectedRange',
    'selectedLineIds',
    'lineIds',
  ]) {
    const value = record[key];

    if (isStringArray(value)) {
      const remIds = uniqueIds(value);

      if (remIds.length > 0) {
        return remIds;
      }
    }
  }

  for (const key of [
    'selectedDeepRemAllIds',
    'selectedRem',
    'selectedRemIds',
    'selectedRems',
    'rems',
    'selectedLines',
  ]) {
    const nestedRemIds = remIdsFromObjectArray(record[key]);

    if (nestedRemIds.length > 0) {
      return nestedRemIds;
    }
  }

  for (const key of [
    'focusProps',
    'selection',
    'selected',
    'currentSelection',
    'args',
    'data',
    'payload',
    'event',
    'detail',
    'context',
    'contextData',
    'openContext',
  ]) {
    const nestedRemIds = extractRemIdsFromSelectionEvent(record[key], depth + 1);

    if (nestedRemIds.length > 0) {
      return nestedRemIds;
    }
  }

  return [];
}

async function findRemsById(plugin: ReactRNPlugin, remIds: string[]): Promise<Rem[]> {
  const rems = await Promise.all(remIds.map((id) => plugin.rem.findOne(id)));
  return rems.filter((rem): rem is Rem => Boolean(rem));
}

export async function getEditorSelectedRemIds(plugin: ReactRNPlugin): Promise<string[]> {
  try {
    const selection = await plugin.editor.getSelectedRem();
    const selectedRemIds = selection?.remIds ?? [];

    if (selectedRemIds.length > 0) {
      return selectedRemIds;
    }

    const currentSelection = await plugin.editor.getSelection();
    return extractRemIdsFromSelectionEvent(currentSelection);
  } catch {
    return [];
  }
}

export async function findTargetRems(
  plugin: ReactRNPlugin,
  args?: CopyCommandArgs,
  cachedSelectedRemIds: string[] = []
): Promise<Rem[]> {
  const commandSelectedRemIds = extractRemIdsFromSelectionEvent(args);

  if (commandSelectedRemIds.length > 0) {
    return findRemsById(plugin, uniqueIds(commandSelectedRemIds));
  }

  const editorSelectedRemIds = await getEditorSelectedRemIds(plugin);

  if (editorSelectedRemIds.length > 0) {
    return findRemsById(plugin, uniqueIds(editorSelectedRemIds));
  }

  const commandContextRemIds = uniqueIds([args?.focusedRem, args?.remId, args?.titleRem]);

  if (commandContextRemIds.length > 0) {
    return findRemsById(plugin, commandContextRemIds);
  }

  if (cachedSelectedRemIds.length > 0) {
    return findRemsById(plugin, uniqueIds(cachedSelectedRemIds));
  }

  const focusedRem = await plugin.focus.getFocusedRem();
  return focusedRem ? [focusedRem] : [];
}
