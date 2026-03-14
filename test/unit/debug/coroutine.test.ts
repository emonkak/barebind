import { describe, expect, it } from 'vitest';

import { type Coroutine, createScope, Lane } from '@/core.js';
import { formatOwnerStack, getOwnerStack } from '@/debug/coroutine.js';

describe('ComponentError', () => {
  it('contains the coroutine stack in the message', () => {
    const coroutine = createCoroutine(
      'Child',
      createCoroutine('Parent', createCoroutine('GrandParent')),
    );

    expect(formatOwnerStack(getOwnerStack(coroutine))).toBe(`GrandParent
\`- Parent
   \`- Child <- ERROR occurred here!`);
  });
});

function createCoroutine(
  name: string,
  owner: Coroutine | null = null,
): Coroutine {
  return {
    name,
    scope: createScope(owner),
    pendingLanes: Lane.NoLane,
    resume: () => {},
  };
}
