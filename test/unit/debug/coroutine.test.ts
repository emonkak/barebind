import { describe, expect, it } from 'vitest';

import { formatOwnerStack, getOwnerStack } from '@/debug/coroutine.js';
import { createScope, MockCoroutine } from '../../mocks.js';

describe('AbortError', () => {
  it('contains the coroutine stack in the message', () => {
    const grandParent = new MockCoroutine('GrandParent');
    const parent = new MockCoroutine('Parent', createScope(grandParent));
    const child = new MockCoroutine('Child', createScope(parent));

    expect(formatOwnerStack(getOwnerStack(child))).toBe(`GrandParent
\`- Parent
   \`- Child <- ERROR occurred here!`);
  });
});
