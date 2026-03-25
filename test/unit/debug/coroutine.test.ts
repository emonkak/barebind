import { describe, expect, it } from 'vitest';
import { Scope } from '@/core.js';
import { formatOwnerStack, getOwnerStack } from '@/debug/coroutine.js';
import { MockCoroutine } from '../../mocks.js';

describe('AbortError', () => {
  it('contains the coroutine stack in the message', () => {
    const grandParent = new MockCoroutine('GrandParent');
    const parent = new MockCoroutine('Parent', Scope.Child(grandParent));
    const child = new MockCoroutine('Child', Scope.Child(parent));

    expect(formatOwnerStack(getOwnerStack(child))).toBe(`GrandParent
\`- Parent
   \`- Child <- ERROR occurred here!`);
  });
});
