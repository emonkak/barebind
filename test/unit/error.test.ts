import { describe, expect, it } from 'vitest';

import { type Coroutine, createScope } from '@/core.js';
import { RenderError } from '@/error.js';

describe('RenderError', () => {
  it('contains the coroutine stack in the message', () => {
    const coroutine = createCoroutine(
      'Child',
      createCoroutine('Parent', createCoroutine('GrandParent')),
    );
    const error = new RenderError(
      'An error occurred while rendering.',
      coroutine,
    );

    expect(error.message).toBe(`An error occurred while rendering.
GrandParent
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
    pendingLanes: -1,
    resume: () => {},
  };
}
