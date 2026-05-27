import assert from 'assert';
import type { ReactRNPlugin, Rem } from '@remnote/plugin-sdk';
import { extractRemIdsFromSelectionEvent, findTargetRems } from './target_rems';

function rem(id: string): Rem {
  return { _id: id } as Rem;
}

function makePlugin(options: {
  rems?: Record<string, Rem>;
  editorSelectedIds?: string[];
  focusedRem?: Rem;
}): ReactRNPlugin {
  const rems = options.rems ?? {};

  return {
    rem: {
      findOne: async (id: string) => rems[id],
    },
    editor: {
      getSelectedRem: async () =>
        options.editorSelectedIds
          ? {
              type: 'Rem',
              remIds: options.editorSelectedIds,
            }
          : undefined,
    },
    focus: {
      getFocusedRem: async () => options.focusedRem,
    },
  } as unknown as ReactRNPlugin;
}

findTargetRems(
  makePlugin({
    rems: {
      selectedA: rem('selectedA'),
      selectedB: rem('selectedB'),
      focused: rem('focused'),
    },
    editorSelectedIds: ['selectedA', 'selectedB'],
    focusedRem: rem('focused'),
  })
)
  .then((targetRems) => {
    assert.deepStrictEqual(extractRemIdsFromSelectionEvent({ remIds: ['eventA', 'eventB'] }), [
      'eventA',
      'eventB',
    ]);
    assert.deepStrictEqual(
      extractRemIdsFromSelectionEvent({
        selection: {
          type: 'Rem',
          remIds: ['nestedEventA'],
        },
      }),
      ['nestedEventA']
    );
    assert.deepStrictEqual(extractRemIdsFromSelectionEvent({ selectedRem: ['selectedEventA'] }), [
      'selectedEventA',
    ]);
    assert.deepStrictEqual(
      extractRemIdsFromSelectionEvent({ selectedRem: [{ _id: 'selectedObjectA' }] }),
      ['selectedObjectA']
    );
    assert.deepStrictEqual(
      extractRemIdsFromSelectionEvent({
        selection: {
          type: 'Text',
          remId: 'textSelectionRem',
        },
      }),
      []
    );
    assert.deepStrictEqual(
      extractRemIdsFromSelectionEvent({
        focusProps: {
          type: 'selectedRange',
          selectedRange: ['rangeA', 'rangeB'],
        },
      }),
      ['rangeA', 'rangeB']
    );
    assert.deepStrictEqual(
      extractRemIdsFromSelectionEvent({
        focusProps: {
          type: 'selectedRange',
          selectedRange: ['rangeChildA', 'rangeChildB'],
          selectedDeepRemHighestLevelIds: ['rootA', 'rootB'],
        },
      }),
      ['rootA', 'rootB']
    );
    assert.deepStrictEqual(
      extractRemIdsFromSelectionEvent({
        focusProps: {
          type: 'selectedRange',
          selectedDeepRemHighestLevelIds: [],
          selectedRange: ['rangeFallbackA', 'rangeFallbackB'],
        },
      }),
      ['rangeFallbackA', 'rangeFallbackB']
    );

    assert.deepStrictEqual(
      targetRems.map((targetRem) => targetRem._id),
      ['selectedA', 'selectedB']
    );

    return findTargetRems(
      makePlugin({
        rems: {
          argA: rem('argA'),
          argB: rem('argB'),
          editorA: rem('editorA'),
        },
        editorSelectedIds: ['editorA'],
      }),
      {
        selectedRem: ['argA', 'argB'],
      }
    );
  })
  .then((targetRems) => {
    assert.deepStrictEqual(
      targetRems.map((targetRem) => targetRem._id),
      ['argA', 'argB']
    );

    return findTargetRems(
      makePlugin({
        rems: {
          commandA: rem('commandA'),
          commandB: rem('commandB'),
          editorA: rem('editorA'),
        },
        editorSelectedIds: ['editorA'],
      }),
      {
        contextData: {
          selectedDeepRemHighestLevelIds: ['commandA', 'commandB'],
        },
      } as any
    );
  })
  .then((targetRems) => {
    assert.deepStrictEqual(
      targetRems.map((targetRem) => targetRem._id),
      ['commandA', 'commandB']
    );

    return findTargetRems(
      makePlugin({
        rems: {
          contextA: rem('contextA'),
          cachedA: rem('cachedA'),
        },
      }),
      {
        focusedRem: 'contextA',
      },
      ['cachedA']
    );
  })
  .then((targetRems) => {
    assert.deepStrictEqual(
      targetRems.map((targetRem) => targetRem._id),
      ['contextA']
    );

    return findTargetRems(
      makePlugin({
        rems: {
          cachedA: rem('cachedA'),
          cachedB: rem('cachedB'),
        },
      }),
      undefined,
      ['cachedA', 'cachedB']
    );
  })
  .then((targetRems) => {
    assert.deepStrictEqual(
      targetRems.map((targetRem) => targetRem._id),
      ['cachedA', 'cachedB']
    );

    return findTargetRems(
      makePlugin({
        focusedRem: rem('focusedOnly'),
      })
    );
  })
  .then((targetRems) => {
    assert.deepStrictEqual(
      targetRems.map((targetRem) => targetRem._id),
      ['focusedOnly']
    );
    console.log('target rem tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
